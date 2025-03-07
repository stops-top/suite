import { G } from '@mobily/ts-belt';

import TrezorConnect, { PROTO, PrecomposedTransactionFinalCardano } from '@trezor/connect';
import {
    isTestnet,
    getDerivationType,
    getUnusedChangeAddress,
    getAddressParameters,
    getNetworkId,
    getProtocolMagic,
    transformUserOutputs,
    formatMaxOutputAmount,
} from '@suite-common/wallet-utils';
import { notificationsActions } from '@suite-common/toast-notifications';
import {
    PrecomposedLevelsCardano,
    PrecomposedTransactionCardano,
} from '@suite-common/wallet-types';
import { selectDevice } from '@suite-common/wallet-core';
import { createThunk } from '@suite-common/redux-utils';

import {
    selectSelectedAccount,
    selectSelectedAccountStatus,
} from 'src/reducers/wallet/selectedAccountReducer';

import { MODULE_PREFIX } from './constants';
import { ComposeTransactionThunkArguments } from './types';

export const composeCardanoSendFormTransactionThunk = createThunk(
    `${MODULE_PREFIX}/composeCardanoSendFormTransactionThunk`,
    async ({ formValues, formState }: ComposeTransactionThunkArguments, { dispatch }) => {
        const { account, feeInfo } = formState;
        const changeAddress = getUnusedChangeAddress(account);
        if (!changeAddress || !account.utxo || !account.addresses) return;

        const predefinedLevels = feeInfo.levels.filter(l => l.label !== 'custom');
        if (formValues.selectedFee === 'custom') {
            predefinedLevels.push({
                label: 'custom',
                feePerUnit: formValues.feePerUnit,
                blocks: -1,
            });
        }

        const outputs = transformUserOutputs(
            formValues.outputs,
            account.tokens,
            account.symbol,
            formValues.setMaxOutputId,
        );

        const addressParameters = getAddressParameters(account, changeAddress.path);

        const response = await TrezorConnect.cardanoComposeTransaction({
            feeLevels: predefinedLevels,
            outputs,
            account: {
                descriptor: account.descriptor,
                addresses: account.addresses,
                utxo: account.utxo,
            },
            changeAddress,
            addressParameters,
            testnet: isTestnet(account.symbol),
        });

        if (!response.success) {
            dispatch(
                notificationsActions.addToast({
                    type: 'sign-tx-error',
                    error: response.payload.error,
                }),
            );

            return;
        }

        const wrappedResponse: PrecomposedLevelsCardano = {};
        response.payload.forEach((t, index) => {
            const tx: PrecomposedTransactionCardano = t;
            switch (tx.type) {
                case 'final':
                    // convert from lovelace units to ADA
                    tx.max = formatMaxOutputAmount(
                        tx.max,
                        outputs.find(o => o.setMax),
                        account,
                    );
                    break;
                case 'nonfinal':
                    // convert lovelace to ADA (for ADA outputs only)
                    tx.max = formatMaxOutputAmount(
                        tx.max,
                        outputs.find(o => o.setMax && o.assets.length === 0),
                        account,
                    );
                    break;
                case 'error':
                    switch (tx.error) {
                        case 'UTXO_BALANCE_INSUFFICIENT':
                            tx.errorMessage = { id: 'AMOUNT_IS_NOT_ENOUGH' };
                            break;
                        case 'UTXO_VALUE_TOO_SMALL':
                            tx.errorMessage = { id: 'AMOUNT_IS_TOO_LOW' };
                            break;
                        default:
                            dispatch(
                                notificationsActions.addToast({
                                    type: 'sign-tx-error',
                                    error: tx.error,
                                }),
                            );
                            break;
                    }
                    break;
                // no default
            }

            const feeLabel = predefinedLevels[index].label;
            wrappedResponse[feeLabel] = tx;
        });

        return wrappedResponse;
    },
);

export const signCardanoSendFormTransactionThunk = createThunk(
    `${MODULE_PREFIX}/signCardanoSendFormTransactionThunk`,
    async (
        { transactionInfo }: { transactionInfo: PrecomposedTransactionFinalCardano },
        { dispatch, getState },
    ) => {
        const selectedAccount = selectSelectedAccount(getState());
        const selectedAccountStatus = selectSelectedAccountStatus(getState());
        const device = selectDevice(getState());

        if (
            G.isNullable(selectedAccount) ||
            selectedAccountStatus !== 'loaded' ||
            !device ||
            !transactionInfo ||
            transactionInfo.type !== 'final'
        )
            return;

        const { symbol, accountType } = selectedAccount;

        if (selectedAccount.networkType !== 'cardano') return;

        // todo: add chunkify once we allow it for Cardano
        const res = await TrezorConnect.cardanoSignTransaction({
            signingMode: PROTO.CardanoTxSigningMode.ORDINARY_TRANSACTION,
            device: {
                path: device.path,
                instance: device.instance,
                state: device.state,
            },
            useEmptyPassphrase: device.useEmptyPassphrase,
            inputs: transactionInfo.inputs,
            outputs: transactionInfo.outputs,
            unsignedTx: transactionInfo.unsignedTx,
            testnet: isTestnet(symbol),
            protocolMagic: getProtocolMagic(symbol),
            networkId: getNetworkId(symbol),
            fee: transactionInfo.fee,
            ttl: transactionInfo.ttl?.toString(),
            derivationType: getDerivationType(accountType),
        });

        if (!res.success) {
            // catch manual error from TransactionReviewModal
            if (res.payload.error === 'tx-cancelled') return;
            dispatch(
                notificationsActions.addToast({
                    type: 'sign-tx-error',
                    error: res.payload.error,
                }),
            );

            return;
        }

        return res.payload.serializedTx;
    },
);

import { useSelector } from 'react-redux';

import { useNavigation } from '@react-navigation/core';

import { IconButton, Text, VStack } from '@suite-native/atoms';
import {
    AccountsImportStackParamList,
    AccountsImportStackRoutes,
    AppTabsRoutes,
    HomeStackRoutes,
    RootStackParamList,
    RootStackRoutes,
    ScreenSubHeader,
    StackToTabCompositeProps,
} from '@suite-native/navigation';
import { Translation } from '@suite-native/intl';
import { selectIsDeviceAccountless } from '@suite-common/wallet-core';

type NavigationProp = StackToTabCompositeProps<
    AccountsImportStackParamList,
    AccountsImportStackRoutes.AccountImportSummary,
    RootStackParamList
>;

export const AccountImportSubHeader = () => {
    const navigation = useNavigation<NavigationProp>();
    const isDeviceAccountless = useSelector(selectIsDeviceAccountless);

    const handleCloseOnboarding = () => {
        navigation.navigate(RootStackRoutes.AppTabs, {
            screen: AppTabsRoutes.HomeStack,
            params: {
                screen: HomeStackRoutes.Home,
            },
        });
    };

    return (
        <ScreenSubHeader
            leftIcon={
                !isDeviceAccountless ? (
                    <IconButton
                        iconName="close"
                        colorScheme="tertiaryElevation0"
                        onPress={handleCloseOnboarding}
                        accessibilityRole="button"
                        accessibilityLabel="close"
                        size="medium"
                    />
                ) : null
            }
            content={
                <VStack alignItems="center" spacing="small">
                    <Text variant="titleSmall" adjustsFontSizeToFit numberOfLines={1}>
                        <Translation id="moduleAccountImport.title" />
                    </Text>
                </VStack>
            }
        />
    );
};

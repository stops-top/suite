import React from 'react';

import { Hint, Kind, Optional, TIntersect, TObject, TSchema } from '@sinclair/typebox';

import { Param } from './Param';

const descriptionDictionary: Record<string, string> = {
    path: 'Derivation path',
    showOnTrezor: 'Display the result on the Trezor device. Default is false',
    chunkify: 'Display the result in chunks for better readability. Default is false',
    suppressBackupWarning:
        'By default, this method will emit an event to show a warning if the wallet does not have a backup. This option suppresses the message.',
    coin: 'determines network definition specified in coins.json file. Coin shortcut, name or label can be used. If coin is not set API will try to get network definition from path.',
    crossChain:
        'Advanced feature. Use it only if you are know what you are doing. Allows to generate address between chains. For example Bitcoin path on Litecoin network will display cross chain address in Litecoin format.',
    unlockPath: 'the result of TrezorConnect.unlockPath method',
    ecdsaCurveName: 'ECDSA curve name to use',
    ignoreXpubMagic: 'ignore SLIP-0132 XPUB magic, use xpub/tpub prefix for all account types.',
    scriptType: 'used to distinguish between various address formats (non-segwit, segwit, etc.).',
};

const getTypeName = (value: TSchema, hasDescendants?: boolean) => {
    let typeName = value[Kind];
    if (value[Kind] === 'Array') {
        const childTypeName = getTypeName(value.items);
        typeName = childTypeName ? `Array<${childTypeName}>` : 'Array';
    } else if (value[Kind] === 'Literal') {
        if (typeof value.const === 'number') {
            typeName = value.const.toString();
        } else {
            typeName = JSON.stringify(value.const);
        }
        if (value.$id) {
            typeName = value.$id + ' (' + typeName + ')';
        }
    } else if (value[Kind] === 'Union' && !hasDescendants) {
        const itemsFiltered = value.anyOf?.filter((v: TSchema, i: number) => {
            // Filter enum non-numbers
            if (value[Hint] === 'Enum' && v[Kind] === 'Literal' && typeof v.const === 'string') {
                return false;
            }
            // Filter union number indexes - unnecessary to display
            if (v[Kind] === 'Literal' && (v.const === i || v.const === i.toString())) {
                return false;
            }

            return true;
        });
        if (itemsFiltered.length > 0) {
            typeName = itemsFiltered?.map((v: TSchema) => getTypeName(v)).join(' | ');
        }
        if (value[Hint] === 'Enum') {
            typeName = 'Enum: ' + typeName;
        }
    } else if (value[Kind] === 'Intersect' && !hasDescendants) {
        typeName = value.anyOf?.map((v: TSchema) => getTypeName(v)).join(' & ');
    } else if (value[Kind] === 'Object' && value.$id) {
        typeName = value.$id;
    }

    return typeName;
};

interface SingleParamProps {
    name: string;
    value: TSchema;
    schema?: TSchema;
    topLevelSchema: TObject | TIntersect | TSchema;
    isTopLevel?: boolean;
}
const SingleParam = ({ name, value, schema, topLevelSchema, isTopLevel }: SingleParamProps) => {
    // Show descendants for complex objects
    const complexObjects = ['Object', 'Union', 'Intersect'];
    let hasDescendants = complexObjects.includes(value[Kind]);
    let typeLink: string | undefined;
    if (value[Kind] === 'Union') {
        // Show descendants for unions only if they contain complex objects
        hasDescendants = value.anyOf.some((v: TSchema) => complexObjects.includes(v[Kind]));
    } else if (value[Kind] === 'Array') {
        // Show descendants for arrays only if they contain complex objects
        hasDescendants = complexObjects.includes(value.items[Kind]);
    } else if (
        value[Kind] === 'Object' &&
        topLevelSchema?.[Kind] === 'Object' &&
        !isTopLevel &&
        value.$id &&
        Object.entries(topLevelSchema.properties).some(([_, val]: any) => val.$id === value.$id)
    ) {
        // If the object is a reference to the top level object, don't show descendants
        hasDescendants = false;
        typeLink = `#${value.$id}`;
    }
    // Get the type name
    const typeName = getTypeName(value, hasDescendants);

    // Required can also be undefined (for example union)
    let isRequired: boolean | undefined;
    if (schema?.required?.includes(name)) {
        isRequired = true;
    } else if (value[Optional] === 'Optional') {
        isRequired = false;
    }

    return (
        <>
            <Param
                id={isTopLevel ? value.$id : undefined}
                key={name}
                name={name}
                type={typeName}
                typeLink={typeLink}
                required={isRequired}
                description={value.description ?? descriptionDictionary[name]}
            />
            {hasDescendants && (
                <div style={{ marginLeft: 30 }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-use-before-define */}
                    <ParamsTable schema={value} topLevelSchema={topLevelSchema} />
                </div>
            )}
        </>
    );
};

type ParamsTableProps = {
    schema: TObject | TIntersect | TSchema;
    topLevelSchema?: TObject | TIntersect | TSchema;
};
export const ParamsTable = ({ schema, topLevelSchema }: ParamsTableProps) => {
    const topLevelSchemaCurrent = topLevelSchema ?? schema;
    if (schema[Kind] === 'Union') {
        return schema.anyOf?.map((param: TSchema, i: number) => (
            <>
                {i > 0 && <h3>or</h3>}
                <ParamsTable key={i} schema={param} topLevelSchema={topLevelSchemaCurrent} />
            </>
        ));
    } else if (schema[Kind] === 'Intersect') {
        return schema.allOf?.map((param: TSchema, i: number) => (
            <ParamsTable key={i} schema={param} topLevelSchema={topLevelSchemaCurrent} />
        ));
    } else if (schema[Kind] === 'Object') {
        return Object.entries(schema.properties)?.map(([name, value]: [string, any]) => (
            <SingleParam
                name={name}
                value={value}
                schema={schema}
                key={name}
                topLevelSchema={topLevelSchemaCurrent}
                isTopLevel={topLevelSchema === undefined}
            />
        ));
    } else if (schema[Kind] === 'Array') {
        return <SingleParam name="" value={schema.items} topLevelSchema={topLevelSchemaCurrent} />;
    } else {
        return <SingleParam name="" value={schema} topLevelSchema={topLevelSchemaCurrent} />;
    }
};

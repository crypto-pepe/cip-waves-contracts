import path = require('path');
import {
  NetworkConfig,
  deployScript,
  ProofsGenerator,
  invoke,
  transfer,
} from '@pepe-team/waves-sc-test-utils';
import { address, seedWithNonce, keyPair } from '@waves/ts-lib-crypto';
import { InvokeScriptCallStringArgument } from '@waves/ts-types';

export default async function (
  deployerSeed: string,
  appliedNonce: number,
  network: NetworkConfig,
  proofsGenerator: ProofsGenerator
) {
  const deployerPrivateKey = keyPair(deployerSeed).privateKey;
  const deployerAddress = address(deployerSeed, network.chainID);

  const multisigAddress = address(
    { publicKey: keyPair(seedWithNonce(deployerSeed, 2)).publicKey },
    network.chainID
  );
  console.log('Multisig contract address =', multisigAddress);

  const signerContract = keyPair(seedWithNonce(deployerSeed, 5));
  const signerContractAddress = address(
    { publicKey: signerContract.publicKey },
    network.chainID
  );
  console.log('Signer contract address =', signerContractAddress);

  await transfer(
    {
      amount: network.invokeFee,
      recipient: signerContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let execChainId;
  let t;
  switch (network.name) {
    case 'mainnet':
      execChainId = 1;
      t = 2;
      break;
    case 'testnet':
      execChainId = 10001;
      t = 2;
      break;
    default:
      execChainId = 10001;
      t = 2;
  }

  let signers: InvokeScriptCallStringArgument[];
  let signerPublicKey;
  switch (network.name) {
    case 'mainnet':
      signerPublicKey = 'GDguuKdo8ZfyHZSq8JsdEecx2GsEFT4kRERz8ujDEUcn';
      signers = [
        {
          type: 'string',
          value: '6K19i3FJ9XVbN6XgMTABb6yHvoEEwDiyyqLhnCzaqyus',
        },
        {
          type: 'string',
          value: '9PkzFLZBRr6ntzhRq9mEg6Zqj2s7Go6YJ9uA7yNjRDDq',
        },
        {
          type: 'string',
          value: '7s3wum6Bp1ceUDrnXxdHc31rxv1FhzRcmPbSQaK9eiP1',
        },
      ];
      break;
    case 'testnet':
      signerPublicKey = 'CU7TWPhow9ETi5NHB4tJwDHpS9LxZrGfZxS2pWDLpLCK';
      signers = [
        {
          type: 'string',
          value: '46i9kgjr3qTQnGxqqFNUh7EhaMiWhdqm7kfBz8BqayNQ',
        },
        {
          type: 'string',
          value: 'FDdrfn5wQrUpbcpAyCwFGG4uzZZJaLJMj8vTLrntn3pW',
        },
        {
          type: 'string',
          value: '2jkwhAHMdoDkNy8vwF8jmhck6BP1ryLbU8QfawRZGyX4',
        },
      ];
      break;
    default:
      signerPublicKey = 'CU7TWPhow9ETi5NHB4tJwDHpS9LxZrGfZxS2pWDLpLCK';
      signers = [
        {
          type: 'string',
          value: '46i9kgjr3qTQnGxqqFNUh7EhaMiWhdqm7kfBz8BqayNQ',
        },
        {
          type: 'string',
          value: 'FDdrfn5wQrUpbcpAyCwFGG4uzZZJaLJMj8vTLrntn3pW',
        },
        {
          type: 'string',
          value: '2jkwhAHMdoDkNy8vwF8jmhck6BP1ryLbU8QfawRZGyX4',
        },
      ];
  }

  await invoke(
    {
      dApp: signerContractAddress,
      call: {
        function: 'setActiveSigners',
        args: [
          {
            type: 'integer',
            value: execChainId, // execChainId_
          },
          {
            type: 'list',
            value: signers, // signers_
          },
          {
            type: 'integer',
            value: t, // t_
          },
          {
            type: 'string',
            value: signerPublicKey,
          },
        ],
      },
    },
    signerContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}

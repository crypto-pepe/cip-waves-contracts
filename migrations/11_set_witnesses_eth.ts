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

  const witnessContract = keyPair(seedWithNonce(deployerSeed, 4));
  const witnessContractAddress = address(
    { publicKey: witnessContract.publicKey },
    network.chainID
  );
  console.log('Witness contract address =', witnessContractAddress);

  await transfer(
    {
      amount: network.invokeFee,
      recipient: witnessContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let callerChainId;
  switch (network.name) {
    case 'mainnet':
      callerChainId = 1;
      break;
    case 'testnet':
      callerChainId = 10001;
      break;
    default:
      callerChainId = 10001;
  }

  let witnesses: InvokeScriptCallStringArgument[];
  switch (network.name) {
    case 'mainnet':
      witnesses = []; // TODO
      throw 'todo';
      break;
    case 'testnet':
      witnesses = [
        {
          type: 'string',
          value: 'G3PuzdShRMHkQqLUsA6hxS1MbqbwfLUukXRu7Q4Lgvyj',
        },
        {
          type: 'string',
          value: 'Aaz49g1R2tPtjcxZZsngBG32FRdECNFXWet7qmC6R86o',
        },
        {
          type: 'string',
          value: 'CBdXtUdZsWb15ZGYKDGx2UfaENr6BheDHYfskMEzvrbw',
        },
      ];
      break;
    default:
      witnesses = [
        {
          type: 'string',
          value: 'G3PuzdShRMHkQqLUsA6hxS1MbqbwfLUukXRu7Q4Lgvyj',
        },
        {
          type: 'string',
          value: 'Aaz49g1R2tPtjcxZZsngBG32FRdECNFXWet7qmC6R86o',
        },
        {
          type: 'string',
          value: 'CBdXtUdZsWb15ZGYKDGx2UfaENr6BheDHYfskMEzvrbw',
        },
      ];
  }

  await invoke(
    {
      dApp: witnessContractAddress,
      call: {
        function: 'setActiveWitnesses',
        args: [
          {
            type: 'integer',
            value: callerChainId, // callerChainId_
          },
          {
            type: 'list',
            value: witnesses, // witnesses_
          },
        ],
      },
    },
    witnessContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}

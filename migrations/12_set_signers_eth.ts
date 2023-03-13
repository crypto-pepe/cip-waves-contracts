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
      execChainId = 2;
      t = 3; // TODO: set
      break;
    case 'testnet':
      execChainId = 10002;
      t = 2;
      break;
    default:
      execChainId = 10002;
      t = 2;
  }

  let signers: InvokeScriptCallStringArgument[];
  switch (network.name) {
    case 'mainnet':
      signers = []; // TODO
      throw 'todo';
      break;
    case 'testnet':
      signers = [
        {
          type: 'string',
          value: 'E7XhXCJsKF5QunHiEWSaK2iX9mkknX9CkYs6dqXaKNS2',
        },
        {
          type: 'string',
          value: 'C275WnZ4VTH63ERxcL93TxhzruLWbGfM8GCpysZpfonh',
        },
        {
          type: 'string',
          value: '3Bva7Xeq3oeEUKgrUCR4CP3urgytwaT5U7WMcM8Z5WSA',
        },
      ];
      break;
    default:
      signers = [
        {
          type: 'string',
          value: 'E7XhXCJsKF5QunHiEWSaK2iX9mkknX9CkYs6dqXaKNS2',
        },
        {
          type: 'string',
          value: 'C275WnZ4VTH63ERxcL93TxhzruLWbGfM8GCpysZpfonh',
        },
        {
          type: 'string',
          value: '3Bva7Xeq3oeEUKgrUCR4CP3urgytwaT5U7WMcM8Z5WSA',
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

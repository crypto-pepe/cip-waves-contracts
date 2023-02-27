import path = require('path');
import {
  NetworkConfig,
  deployScript,
  ProofsGenerator,
  invoke,
  transfer,
} from '@pepe-team/waves-sc-test-utils';
import { address, seedWithNonce, keyPair } from '@waves/ts-lib-crypto';

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

  const evmCallerContract = keyPair(seedWithNonce(deployerSeed, 6));
  const evmCallerContractAddress = address(
    { publicKey: evmCallerContract.publicKey },
    network.chainID
  );
  console.log('EVM Caller contract address =', evmCallerContractAddress);

  // Deploy evmCallerContract
  await transfer(
    {
      amount: network.setScriptFee + 2 * network.invokeFee,
      recipient: evmCallerContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/evm_caller.ride'),
    evmCallerContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: evmCallerContractAddress,
      call: {
        function: 'setMultisig',
        args: [
          {
            type: 'string',
            value: multisigAddress,
          },
        ],
      },
    },
    evmCallerContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let callChainId;
  switch (network.name) {
    case 'mainnet':
      callChainId = 1;
      break;
    case 'testnet':
      callChainId = 10001;
      break;
    default:
      callChainId = 10001;
  }

  await invoke(
    {
      dApp: evmCallerContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: multisigAddress, // pauser_
          },
          {
            type: 'integer',
            value: callChainId, // callChainId_
          },
        ],
      },
    },
    evmCallerContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}

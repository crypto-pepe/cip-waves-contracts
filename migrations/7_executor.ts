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

  const executorContract = keyPair(seedWithNonce(deployerSeed, 7));
  const executorContractAddress = address(
    { publicKey: executorContract.publicKey },
    network.chainID
  );
  console.log('Executor contract address =', executorContractAddress);

  // Deploy executorContract
  await transfer(
    {
      amount: network.setScriptFee + 2 * network.invokeFee,
      recipient: executorContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/executor.ride'),
    executorContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: executorContractAddress,
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
    executorContract.privateKey,
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

  let signerPublicKey;
  switch (network.name) {
    case 'mainnet':
      signerPublicKey = 'FDAosgVyXn8MRQr7fQJbe5H2T2Q3emoqyauUx7F7toM5';
      break;
    case 'testnet':
      signerPublicKey = 'CU7TWPhow9ETi5NHB4tJwDHpS9LxZrGfZxS2pWDLpLCK';
      break;
    default:
      signerPublicKey = 'CU7TWPhow9ETi5NHB4tJwDHpS9LxZrGfZxS2pWDLpLCK';
  }

  await invoke(
    {
      dApp: executorContractAddress,
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
          {
            type: 'string',
            value: signerPublicKey, // signerPublicKey_
          },
        ],
      },
    },
    executorContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}

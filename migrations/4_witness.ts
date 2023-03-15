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

  const tokenContract = keyPair(seedWithNonce(deployerSeed, 3));
  const tokenContractAddress = address(
    { publicKey: tokenContract.publicKey },
    network.chainID
  );
  console.log('PCBT token contract address =', tokenContractAddress);

  const witnessContract = keyPair(seedWithNonce(deployerSeed, 4));
  const witnessContractAddress = address(
    { publicKey: witnessContract.publicKey },
    network.chainID
  );
  console.log('Witness contract address =', witnessContractAddress);

  // Deploy witnessContract
  const deployScriptFee = 2600000;
  await transfer(
    {
      amount: deployScriptFee + 4 * network.invokeFee,
      recipient: witnessContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/witness.ride'),
    witnessContract.privateKey,
    network,
    proofsGenerator,
    deployScriptFee
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: witnessContractAddress,
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
    witnessContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: witnessContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'integer',
            value: 10000000, // proxySecDepoPerEvent_
          },
          {
            type: 'string',
            value: tokenContractAddress, // rewardTokenAddress_
          },
          {
            type: 'integer',
            value: 100000, // rewardAmount_
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

  let wavesChainId;
  let ethChainId;
  switch (network.name) {
    case 'mainnet':
      wavesChainId = 1;
      ethChainId = 2;
      break;
    case 'testnet':
      wavesChainId = 10001;
      ethChainId = 10002;
      break;
    default:
      wavesChainId = 10001;
      ethChainId = 10002;
  }

  await invoke(
    {
      dApp: witnessContractAddress,
      call: {
        function: 'setEventType',
        args: [
          {
            type: 'integer',
            value: wavesChainId, // execChainId_
          },
          {
            type: 'string',
            value: 'WAVES', // type_
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

  await invoke(
    {
      dApp: witnessContractAddress,
      call: {
        function: 'setEventType',
        args: [
          {
            type: 'integer',
            value: ethChainId, // execChainId_
          },
          {
            type: 'string',
            value: 'EVM', // type_
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

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

  const signerContract = keyPair(seedWithNonce(deployerSeed, 5));
  const signerContractAddress = address(
    { publicKey: signerContract.publicKey },
    network.chainID
  );
  console.log('Signer contract address =', signerContractAddress);

  // Deploy signerContract
  const deployScriptFee = 1900000;
  await transfer(
    {
      amount: deployScriptFee + 2 * network.invokeFee,
      recipient: signerContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/signer.ride'),
    signerContract.privateKey,
    network,
    proofsGenerator,
    deployScriptFee
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: signerContractAddress,
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
    signerContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: signerContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'integer',
            value: 10000000, // minSecDepo_
          },
          {
            type: 'integer',
            value: 10000000, // punishment_
          },
          {
            type: 'integer',
            value: 1440, // resetBlockDelta_
          },
          {
            type: 'string',
            value: tokenContractAddress, // rewardTokenAddress_
          },
          {
            type: 'integer',
            value: 200000, // rewardAmount_
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

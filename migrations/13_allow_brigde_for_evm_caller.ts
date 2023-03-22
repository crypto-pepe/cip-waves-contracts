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

  const evmCallerContract = keyPair(seedWithNonce(deployerSeed, 6));
  const evmCallerContractAddress = address(
    { publicKey: evmCallerContract.publicKey },
    network.chainID
  );
  console.log('EVM Caller contract address =', evmCallerContractAddress);

  await transfer(
    {
      amount: network.invokeFee,
      recipient: evmCallerContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let brigdeAddress;
  switch (network.name) {
    case 'mainnet':
      brigdeAddress = '3P8r3cutvYsKAKaLeXMbTpdyyK48k5noFs1';
      break;
    case 'testnet':
      brigdeAddress = '3NAkcL7Cjf7RTGyExKbu3QCdVSAhVM2gFHN';
      break;
    default:
      brigdeAddress = '3NAkcL7Cjf7RTGyExKbu3QCdVSAhVM2gFHN';
  }

  await invoke(
    {
      dApp: evmCallerContractAddress,
      call: {
        function: 'allow',
        args: [
          {
            type: 'string',
            value: brigdeAddress,
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

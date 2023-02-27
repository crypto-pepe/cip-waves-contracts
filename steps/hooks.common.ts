import { keyPair, TPrivateKey } from '@waves/ts-lib-crypto';
import { broadcast, setScript, waitForTx } from '@waves/waves-transactions';
import { getEnvironment } from 'relax-env-json';
import {
  compileScript,
  Contract,
  deployScript,
  transfer,
  getBalance,
} from '@pepe-team/waves-sc-test-utils';
import { setTxSign } from './common';
const env = getEnvironment();

export async function setTechContract(
  contracts: any[],
  rootSeed: string,
  testDir: string
): Promise<Contract> {
  console.info('set tech contract state...');
  const techContract = contracts.filter((c) => c.name == 'technical')[0];
  techContract.path = testDir + techContract.path;
  await transfer(
    {
      recipient: techContract.dApp,
      amount: env.amountPerContract + 2,
    },
    keyPair(rootSeed).privateKey,
    env.network
  );
  await deployScript(techContract.path, techContract.privateKey, env.network);
  console.info('tech contract deployed');
  return {
    name: 'technical',
    privateKey: techContract.privateKey,
    publicKey: techContract.publicKey,
    dApp: techContract.dApp,
    path: techContract.path,
  };
}

export async function deployMultisigContract(
  contracts: any[],
  name: string,
  rootSeed: string,
  withFunds = true,
  amount: number = env.amountPerContract + 2
): Promise<Contract> {
  const contract = contracts.filter((c) => c.name == name)[0];
  if (withFunds) {
    await sendFunds(contract, rootSeed, amount);
  }
  console.info(`create ${name} deploy transaction...`);
  const compiledScript = await compileScript(contract.path);
  const privateKey: TPrivateKey = { privateKey: contract.privateKey };
  const tx = setScript(
    {
      script: compiledScript.script,
      chainId: env.network.chainID,
      additionalFee: env.network.additionalFee,
    },
    privateKey
  );
  console.info('set multisig state...');
  await setTxSign(contract.dApp, tx.id);
  console.info(`deploy ${name} contract...`);
  await broadcast(tx, env.network.nodeAPI);
  const txMined = await waitForTx(tx.id, {
    apiBase: env.network.nodeAPI,
    timeout: env.network.nodeTimeout,
  });
  if (txMined.applicationStatus !== 'succeeded') {
    throw new Error(`Can't deploy ${name} script =(`);
  }
  console.info(`${name} contract deployed`);
  console.info(
    `Contract balance: ${await getBalance(contract.dApp, env.network)}`
  );
  return {
    name: name,
    privateKey: contract.privateKey,
    publicKey: contract.publicKey,
    dApp: contract.dApp,
    path: contract.path,
  };
}

export async function sendFunds(
  contract: Contract,
  rootSeed: string,
  amount: number
): Promise<void> {
  console.info(`send ${amount} WAVES to ${contract.name} contract address...`);
  await transfer(
    {
      recipient: contract.dApp,
      amount: amount,
    },
    keyPair(rootSeed).privateKey,
    env.network
  );
}

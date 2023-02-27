import {
  Account,
  Asset,
  Contract,
  createContracts,
  getLastBlockId,
  initAccounts,
  initAssets,
  setAssetsForAccounts,
} from '@pepe-team/waves-sc-test-utils';
import { Context } from 'mocha';
import { getEnvironment } from 'relax-env-json';
import { setSteps } from '../../steps/common';
import { setContract } from '../../steps/executor';
import {
  deployMultisigContract,
  setTechContract,
} from '../../steps/hooks.common';
const env = getEnvironment();

export type TestContext = Mocha.Context & Context;
export type InjectableContext = Readonly<{
  accounts: Account[];
  assets: Asset[];
  contracts: Contract[];
  start_block: string;
}>;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const initData = require('./data/init.json');
const rootSeed = initData.rootSeed;

export const mochaHooks = async (): Promise<Mocha.RootHookObject> => {
  return {
    async beforeAll(this: Mocha.Context) {
      const assets = await initAssets(env.assets, rootSeed, env.network);
      console.table(assets);

      const accounts = await initAccounts(
        rootSeed,
        env.accounts,
        env.amountPerAccount,
        env.network
      );
      await setAssetsForAccounts(
        rootSeed,
        accounts,
        assets,
        env.amountPerAsset,
        env.network
      );
      console.table(accounts);

      const init_contracts = createContracts(
        rootSeed,
        env.contracts,
        env.network,
        accounts.length + 1
      );
      const contracts: Contract[] = [];
      const techContract = await setTechContract(
        init_contracts,
        rootSeed,
        'test/executor/'
      );
      contracts.push(techContract);
      // set mock contract
      setSteps(techContract, accounts.filter((a) => a.name == 'tech_acc')[0]);

      // Deploy evm_caller
      contracts.push(
        await deployMultisigContract(init_contracts, 'executor', rootSeed)
      );
      setContract(contracts.filter((f) => f.name == 'executor')[0]);

      const context: InjectableContext = {
        accounts: accounts,
        assets: assets,
        contracts: contracts,
        start_block: await getLastBlockId(env.network),
      };
      Object.assign(this, context);
    },
  };
};

import {
  Account,
  Asset,
  Contract,
  createContracts,
  getDataValue,
  getLastBlockId,
  initAccounts,
  initAssets,
  setAssetsForAccounts,
} from '@pepe-team/waves-sc-test-utils';
import { Context } from 'mocha';
import { getEnvironment } from 'relax-env-json';
import { getTechUser, setSteps } from '../../steps/common';
import {
  deployMultisigContract,
  setTechContract,
} from '../../steps/hooks.common';
import { init as initMultisig, setContract } from '../../steps/multisig';
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
        'test/multisig/'
      );
      contracts.push(techContract);
      // set mock contract
      const isRedeploy = await getDataValue(
        init_contracts.filter((c) => c.name === 'multisig')[0],
        'MULTISIG',
        env.network,
        false
      );
      setSteps(
        !isRedeploy
          ? techContract
          : init_contracts.filter((c) => c.name === 'multisig')[0],
        accounts.filter((a) => a.name == 'tech_acc')[0]
      );
      // deploy multisig
      const multisig_ = await deployMultisigContract(
        init_contracts,
        'multisig',
        rootSeed
      );
      contracts.push(multisig_);
      setSteps(multisig_, getTechUser());
      //set multisig
      setContract(contracts.filter((c) => c.name == 'multisig')[0]);
      await initRealMultisig(contracts, [getTechUser().publicKey], 1);

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

async function initRealMultisig(
  contracts: Contract[],
  owners: string[],
  quorum: number
) {
  try {
    await initMultisig(
      contracts.filter((c) => c.name === 'multisig')[0],
      owners,
      quorum
    );
    console.info('multisig initialized');
  } catch {
    console.info('multisig already initialized');
  }
}

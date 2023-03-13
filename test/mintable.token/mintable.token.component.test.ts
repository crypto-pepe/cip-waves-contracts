import {
  getAccountByName,
  getAssetBalance,
  getBalance,
  getContractByName,
  getDataValue,
  invoke,
  transfer,
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
import { expect } from 'chai';
import {
  step,
  stepCatchError,
  stepIgnoreErrorByMessage,
} from 'relax-steps-allure';
import {
  getAssetContractBalance,
  Sender,
  setSignedContext,
  signedTransfer,
} from '../../steps/common';
import { getEnvironment } from 'relax-env-json';
import {
  addMinter,
  init,
  mint,
  mintMany,
  removeMinter,
  setMultisig,
  setSponsorshipManager,
  updateSponsorship,
} from '../../steps/mintable.token';
import {
  Asset,
  getAssetInfo,
} from '@pepe-team/waves-sc-test-utils/build/src/assets';
import { fetchEvaluate } from '@waves/node-api-js/cjs/api-node/utils';
const env = getEnvironment();

/**
 * BUGS:    3) [MINOR] mintMany() have no duplicate check
 *          4) [MINOR] mintMany() have no recipient validation
 *          5) [MINOR] mintMany() have no empty list check
 *
 * MEMO:    1) init(), incorrect multisig address: best practise when same errors have same messages
 *          2) removeMinter(): why we need to check minter's address?
 *          3) [MINOR] init() description can be empty
 * 
 * REPAIRED:2) [NORMAL] addMinter() add SEPARATOR after alone minter address
 * 
 */
describe('Mintable token component', function () {
  /**
   * REQUIRED: clear state
   */
  xdescribe('before all special tests', async () => {
    it('[init] should throw when multisig not set', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenMultisigSet: revert',
        async () => {
          await init('token', 'token description', 18);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'INIT', env.network, false)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network, -1)).to.be.equal(-1);
      });
    });
  });

  describe('setMultisig tests', function () {
    // Need a clear state
    xit('should throw when it is not self-call', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startMultisig = await getDataValue(
        contract,
        'MULTISIG',
        env.network,
        null
      );
      expect(startMultisig).is.null;
      await stepIgnoreErrorByMessage(
        'try to set multisig',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'setMultisig',
                args: [{ type: 'string', value: base58Encode(user.address) }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      const endMultisig = await getDataValue(
        contract,
        'MULTISIG',
        env.network,
        null
      );
      await step('check state', async () => {
        expect(endMultisig).is.null;
      });
    });

    // MEMO: best practise when same errors have same messages
    it('should throw when incorrect multisig address', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const startMultisig = await getDataValue(
        contract,
        'MULTISIG',
        env.network
      );
      await stepIgnoreErrorByMessage(
        'try to set multisig',
        'Error while executing dApp: setMultisig: invalid multisig',
        async () => {
          await setMultisig('123abc123abc123abc123abc123abc12');
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(startMultisig);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(techConract.dApp);
      });
    });

    it('can change multisig addres the same', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(techConract.dApp);
      });
    });
  });

  describe('init tests', function () {
    it('should throw when no self-call', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = false', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'init',
                args: [
                  { type: 'string', value: 'token' },
                  { type: 'string', value: 'token description' },
                  { type: 'integer', value: 8 },
                ],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
      });
    });

    it('should throw when already initialized', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenNotInitialized: revert',
        async () => {
          await init('token', 'token description', 13);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('sould throw when token name length less than 4 signs', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid token name',
        async () => {
          await init('BTC', 'token description', 13);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('should throw when token name length more than 16 signs', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid token name',
        async () => {
          await init('ThisIsLongTokenNm', 'token description', 13);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('should throw when token description length more than 255 signs', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid token description',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await init('ThisIsLongTokenN', '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345', 13);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('should throw when decimals value less than 0', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid decimals',
        async () => {
          await init('ThisIsLongTokenN', 'token description', -1);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('should throw when decimals value more than 8', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid decimals',
        async () => {
          await init('ThisIsLongTokenN', 'token description', 9);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.empty;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init contract', async () => {
        await init('TOKEN', 'token description', 0);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.not.empty;
      });
    });

    it('can init mintable token with empty description', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init contract', async () => {
        await init('TOKEN', '', 8);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        expect(await getDataValue(contract, 'ASSET', env.network)).is.not.empty;
      });
    });
  });

  describe('addMinter tests', function () {
    it('should throw when no self-call', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: false },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add minter',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'addMinter',
                args: [{ type: 'string', value: 'minter' }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.false;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${user.address}`, type: 'boolean', value: false },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add minter',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await addMinter(user.address);
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.false;
      });
    });

    // WHY IN ERROR MESSAGE "INIT"?
    it('should throw when wrong minter address', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: true }],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add minter',
        'Error while executing dApp: init: invalid minter',
        async () => {
          await addMinter('');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MINTER__', env.network, false)).is.false;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: false },
          ],
        });
      });
      await step('add minter', async () => {
        await addMinter(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
      });
    });

    it('should throw when try to add same minter', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('try to add same minter', async () => {
        await addMinter(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
      });
    });
  });

  describe('removeMinter tests', function () {
    it('should throw when no self-call', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to remove minter',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'removeMinter',
                args: [{ type: 'string', value: 'minter' }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to remove minter',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await removeMinter(user.address);
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
      });
    });

    // WHY IN ERROR MESSAGE "INIT"?
    it('should throw when wrong minter address', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to remove minter',
        'Error while executing dApp: init: invalid minter',
        async () => {
          await removeMinter('');
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MINTER__', env.network, true)).is.true;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('remove minter', async () => {
        await removeMinter(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.false;
      });
    });

    it('can remove same minter', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: false },
          ],
        });
      });
      await step('remove minter', async () => {
        await removeMinter(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.false;
      });
    });

    // needed clear state
    it('can remove unknown minter', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('jack', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('remove minter', async () => {
        await removeMinter(user2.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, `MINTER__${user.address}`, env.network)
        ).is.true;
        expect(
          await getDataValue(contract, `MINTER__${user2.address}`, env.network)
        ).is.false;
      });
    });
  });

  describe('getAssetId test', function () {
    it('simple test', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          // eslint-disable-next-line prettier/prettier
          data: [{ key: 'ASSET', type: 'string', value: base58Encode(user.address) }],
        });
      });
      let asset: any;
      await step('get asset', async () => {
        asset = await fetchEvaluate(
          env.network.nodeAPI,
          contract.dApp,
          'getAssetId()'
        );
      });
      await step('check asset ID', async () => {
        expect(asset.result.value._2.value).to.be.equal(user.address);
      });
    });
  });

  describe('getDecimals tests', function () {
    // eslint-disable-next-line prettier/prettier
    it('should throw when can\'t load asset', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          // eslint-disable-next-line prettier/prettier
          data: [{ key: 'ASSET', type: 'string', value: '' }],
        });
      });
      let asset: any;
      await step('get asset', async () => {
        asset = await fetchEvaluate(
          env.network.nodeAPI,
          contract.dApp,
          'getDecimals()'
        );
      });
      await step('check error', async () => {
        expect(asset.error).to.be.equal(306);
        expect(asset.message).to.be.equal('getDecimals: revert');
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const decimals = 7;
      await step('set state', async () => {
        await setSignedContext(contract, {
          // eslint-disable-next-line prettier/prettier
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', decimals);
      });
      let asset: any;
      await step('get asset', async () => {
        asset = await fetchEvaluate(
          env.network.nodeAPI,
          contract.dApp,
          'getDecimals()'
        );
      });
      await step('check asset decimals', async () => {
        expect(asset.result.value._2.value).to.be.equal(decimals);
      });
    });
  });

  describe('mint tests', function () {
    it('shouldt throw when not initialized', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mint',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await mint(100000000, recipient.address, minter);
        }
      );
    });

    it('should throw when call not minter', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mint',
        'Error while executing dApp: _onlyMinter: revert',
        async () => {
          await mint(100000000, recipient.address, user);
        }
      );
    });

    it('should throw when amount less than 0', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mint',
        'Error while executing dApp: mint: invalid amount',
        async () => {
          await mint(-1, recipient.address, minter);
        }
      );
    });

    it('should throw when amount more than Int max value', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mint',
        'Error while executing dApp: mint: invalid amount',
        async () => {
          await mint('9223372036854775808', recipient.address, minter);
        }
      );
    });

    it('should throw when wrong recipient address', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mint',
        'Error while executing dApp: mint: invalid recipient',
        async () => {
          await mint(123456, '321abc', minter);
        }
      );
    });

    it('simple positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      const amount = 1366000000;
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      // eslint-disable-next-line prettier/prettier
      const startRecpAssetBalance = await getAssetBalance(asset, recipient, env.network);
      await step('mint', async () => {
        await mint(amount, recipient.address, minter);
      });
      // check recp balance
      await step('check recipient token balance', async () => {
        expect(
          await getAssetBalance(asset, recipient, env.network)
        ).to.be.equal(startRecpAssetBalance + amount);
      });
    });
  });

  describe('mintMany tests', function () {
    it('should throw when not initialized', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mintMany',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await mintMany(100000000, [{ type: 'string', value: recipient.address }], minter);
        }
      );
    });

    it('should throw when call not minter', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mintMany',
        'Error while executing dApp: _onlyMinter: revert',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await mintMany(100000000, [{ type: 'string', value: recipient.address }], user);
        }
      );
    });

    it('should throw when amount less than 0', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mintMany',
        'Error while executing dApp: mint: invalid amount',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await mintMany(-1, [{ type: 'string', value: recipient.address }], minter);
        }
      );
    });

    it('should thrwow hen amount more than max Int value', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to mintMany',
        'Error while executing dApp: mint: invalid amount',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await mintMany('9223372036854775808', [{ type: 'string', value: recipient.address }], minter);
        }
      );
    });

    it('simple positive with 3 duplicated recipients', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      const amount = 1366000000;
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      // eslint-disable-next-line prettier/prettier
      const startRecpAssetBalance = await getAssetBalance(asset, recipient, env.network);
      await step('mintMany', async () => {
        await mintMany(
          amount,
          [
            { type: 'string', value: recipient.address },
            { type: 'string', value: recipient.address },
            { type: 'string', value: recipient.address },
          ],
          minter
        );
      });
      await step('check recipient token balance', async () => {
        expect(
          await getAssetBalance(asset, recipient, env.network)
        ).to.be.equal(startRecpAssetBalance + 3 * amount);
      });
    });

    it('can call with empty recipient list', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      const amount = 1366000000;
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      // eslint-disable-next-line prettier/prettier
      const startRecpAssetBalance = await getAssetBalance(asset, recipient, env.network);
      await step('mintMany', async () => {
        await mintMany(amount, [], minter);
      });
      await step('check recipient token balance', async () => {
        expect(
          await getAssetBalance(asset, recipient, env.network)
        ).to.be.equal(startRecpAssetBalance);
      });
    });

    it('should throw when list contains more than 51 recipient', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const minter = getAccountByName('neo', this.parent?.ctx);
      const recipient = getAccountByName('morpheus', this.parent?.ctx);
      const amount = 1366000000;
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `MINTER__${minter.address}`, type: 'boolean', value: true },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      // eslint-disable-next-line prettier/prettier
      const startRecpAssetBalance = await getAssetBalance(asset, recipient, env.network);
      const recpList: string[] = [];
      for (let i = 0; i < 51; i++) {
        recpList.push(recipient.address);
      }
      const isError = await stepCatchError('mintMany', async () => {
        await mintMany(amount, recpList, minter);
      });
      await step('check error', async () => {
        expect(isError).is.true;
      });
      await step('check recipient token balance', async () => {
        expect(
          await getAssetBalance(asset, recipient, env.network)
        ).to.be.equal(startRecpAssetBalance);
      });
    });
  });

  describe('setSponsorshipManager tests', function () {
    it('should throw when no self-call', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set sponsorship manager',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'setSponsorshipManager',
                args: [{ type: 'string', value: user.address }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)).is.empty;
      });
    });

    it('should throw when wrong manager address', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set sponsorship manager',
        'Error while executing dApp: setSponsorshipManager: invalid manager',
        async () => {
          await setSponsorshipManager('321abc');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)).is.empty;
      });
    });

    it('simply positive', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set sponsorship manager',
        'Error while executing dApp: setSponsorshipManager: invalid manager',
        async () => {
          await setSponsorshipManager(user.address);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)).to.be.equal(user.address);
      });
    });
  });

  describe('updateSponsorship tests', function () {
    it('should throw when call no-manager', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      const fee = 1000000;
      const amt = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'ty to update sponsorship',
        'Error while executing dApp: _onlySponsorshipManager: revert',
        async () => {
          await updateSponsorship(fee, amt, user);
        }
      );
    });

    it('should throw when asset fee less than 0', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const amt = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'ty to update sponsorship',
        'Error while executing dApp: updateSponsorship: invalid sponsor fee',
        async () => {
          await updateSponsorship(-1, amt, manager);
        }
      );
    });

    it('should throw when asset fee more than max Int value', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const amt = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'ty to update sponsorship',
        'Error while executing dApp: updateSponsorship: invalid sponsor fee',
        async () => {
          await updateSponsorship('9223372036854775808', amt, manager);
        }
      );
    });

    it('should throw when required amount less than 0', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const fee = 1000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'ty to update sponsorship',
        'Error while executing dApp: updateSponsorship: invalid waves required amount',
        async () => {
          await updateSponsorship(fee, -1, manager);
        }
      );
    });

    it('should throw when required amount more than max Int value', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const fee = 1000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'ty to update sponsorship',
        'Error while executing dApp: updateSponsorship: invalid waves required amount',
        async () => {
          await updateSponsorship(fee, '9223372036854775808', manager);
        }
      );
    });

    it('simple positive without any transfers', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const fee = 1000000;
      const amt = 1000000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
          ],
        });
      });
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      await step('normalize token contract balances', async () => {
        const contractSender: Sender = {
          address: contract.dApp,
          publicKey: contract.publicKey,
          privateKey: contract.privateKey,
        };
        // eslint-disable-next-line prettier/prettier
        const diff = await getBalance(contract.dApp, env.network) - amt;
        if (diff > 0) {
          // transfer to user
          await signedTransfer(contractSender, techUser.address, diff);
        } else {
          await transfer(
            {
              recipient: contract.dApp,
              amount: -1 * diff,
            },
            techUser.privateKey,
            env.network
          );
        }
        // eslint-disable-next-line prettier/prettier
        const assetDiff = await getAssetContractBalance(asset, contract, env.network);
        if (assetDiff > 0) {
          // transfer to user
          await signedTransfer(contractSender, techUser.address, diff, assetId);
        }
      });
      // eslint-disable-next-line prettier/prettier
      const startMgrAssetBalance = await getAssetBalance(asset, manager, env.network);
      const startMgrBalance = await getBalance(manager.address, env.network);
      // eslint-disable-next-line prettier/prettier
      const startContractAssetBalance = await getAssetContractBalance(asset, contract, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('update sponsorship', async () => {
        await updateSponsorship(fee, amt, manager);
      });
      await step('check manager balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetBalance(asset, manager, env.network)).to.be.equal(startMgrAssetBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(manager.address, env.network)).to.be.equal(startMgrBalance - env.network.invokeFee);
      });
      await step('check contract balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetContractBalance(asset, contract, env.network)).to.be.equal(startContractAssetBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    it('update with 0 fee and with asset tokens transfer to manager', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const fee = 0;
      const amt = 1000000000;
      const mintAmt = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
            { key: 'MINTERS', type: 'string', value: manager.address },
          ],
        });
      });
      // eslint-disable-next-line prettier/prettier
      console.info(`CONTRACT BALANCE: ${await getBalance(contract.dApp, env.network)}`);
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      await step('normalize token contract balances', async () => {
        const contractSender: Sender = {
          address: contract.dApp,
          publicKey: contract.publicKey,
          privateKey: contract.privateKey,
        };
        // eslint-disable-next-line prettier/prettier
        const diff = await getBalance(contract.dApp, env.network) - amt;
        if (diff > 0) {
          // transfer to user
          await signedTransfer(contractSender, techUser.address, diff);
        } else {
          await transfer(
            {
              recipient: contract.dApp,
              amount: -1 * diff,
            },
            techUser.privateKey,
            env.network
          );
        }
        // eslint-disable-next-line prettier/prettier
        const assetDiff = await getAssetContractBalance(asset, contract, env.network);
        if (assetDiff == 0) {
          // mint & transfer to contractss
          await mint(mintAmt, techUser.address, manager);
          await transfer(
            {
              recipient: contract.dApp,
              amount: mintAmt,
              assetId: assetId,
            },
            techUser.privateKey,
            env.network
          );
        }
      });
      // eslint-disable-next-line prettier/prettier
      const startMgrAssetBalance = await getAssetBalance(asset, manager, env.network);
      const startMgrBalance = await getBalance(manager.address, env.network);
      // eslint-disable-next-line prettier/prettier
      const startContractAssetBalance = await getAssetContractBalance(asset, contract, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('update sponsorship', async () => {
        await updateSponsorship(fee, amt, manager);
      });
      await step('check manager balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetBalance(asset, manager, env.network)).to.be.equal(startMgrAssetBalance + startContractAssetBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(manager.address, env.network)).to.be.equal(startMgrBalance - env.network.invokeFee);
      });
      await step('check contract balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetContractBalance(asset, contract, env.network)).to.be.equal(0);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    it('update with transfer waveses', async () => {
      const contract = getContractByName('mintable_token', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const manager = getAccountByName('neo', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const fee = 0;
      const amt = 1000000000;
      const amtDiff = 6613000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'SPONSORSHIP_MANAGER', type: 'string', value: manager.address },
            { key: 'ASSET', type: 'string', value: '' },
            { key: 'MINTERS', type: 'string', value: manager.address },
          ],
        });
      });
      // eslint-disable-next-line prettier/prettier
      console.info(`CONTRACT BALANCE: ${await getBalance(contract.dApp, env.network)}`);
      await step('init', async () => {
        await init('TOKEN', 'test token', 8);
      });
      // eslint-disable-next-line prettier/prettier
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      const assetInfo = await getAssetInfo(assetId, env.network);
      const asset: Asset = {
        name: assetInfo.name,
        description: assetInfo.description,
        quantity: 1,
        decimals: assetInfo.decimals,
        assetId: assetId,
      };
      await step('normalize token contract balances', async () => {
        const contractSender: Sender = {
          address: contract.dApp,
          publicKey: contract.publicKey,
          privateKey: contract.privateKey,
        };
        // eslint-disable-next-line prettier/prettier
        const diff = await getBalance(contract.dApp, env.network) - amt;
        if (diff > amtDiff) {
          // eslint-disable-next-line prettier/prettier
          await signedTransfer(contractSender, techUser.address, diff - amtDiff);
        } else {
          await transfer(
            {
              recipient: contract.dApp,
              amount: amtDiff - diff,
            },
            techUser.privateKey,
            env.network
          );
        }
        // eslint-disable-next-line prettier/prettier
        const assetDiff = await getAssetContractBalance(asset, contract, env.network);
        if (assetDiff > 0) {
          // transfer to contractss
          // eslint-disable-next-line prettier/prettier
          await signedTransfer(contractSender, techUser.address, assetDiff, assetId);
        }
      });
      // eslint-disable-next-line prettier/prettier
      const startMgrAssetBalance = await getAssetBalance(asset, manager, env.network);
      const startMgrBalance = await getBalance(manager.address, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('update sponsorship', async () => {
        await updateSponsorship(fee, amt, manager);
      });
      await step('check manager balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetBalance(asset, manager, env.network)).to.be.equal(startMgrAssetBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(manager.address, env.network)).to.be.equal(startMgrBalance + amtDiff - env.network.invokeFee);
      });
      await step('check contract balances', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getAssetContractBalance(asset, contract, env.network)).to.be.equal(0);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - amtDiff);
      });
    });
  });
});

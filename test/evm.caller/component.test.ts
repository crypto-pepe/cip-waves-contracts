import {
  getAccountByName,
  getContractByName,
  getDataValue,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { expect } from 'chai';
import { getEnvironment } from 'relax-env-json';
import { base58Encode } from '@waves/ts-lib-crypto';
import {
  allow,
  call,
  disallow,
  init,
  pause,
  selfCall,
  setMultisig,
  unpause,
  updatePauser,
} from '../../steps/evm.caller';
import { setSignedContext } from '../../steps/common';
const env = getEnvironment();

/**
 * BUG:   1) [call] have no caller address validation
 *        2) [call] nonce in event set after increment but need BEFORE
 */
describe('EVM Caller component', function () {
  // REQUIRED: clear state
  describe('before all special tests', async () => {
    it('[init] should throw when multisig not set', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenMultisigSet: revert',
        async () => {
          await init(user.address, 0);
        }
      );
      await step('check PAUSER', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network, '')).is
          .empty;
      });
    });
  });

  describe('setMultisig tests', function () {
    it('should throw when it is not self-call', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
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
      expect(endMultisig).is.null;
    });

    it('should throw when incorrect multisig address', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const startMultisig = await getDataValue(
        contract,
        'MULTISIG',
        env.network
      );
      await stepIgnoreErrorByMessage(
        'try to set multisig',
        'Error while executing dApp: setMultisig: invalid multisig address',
        async () => {
          await setMultisig('123abc123abc123abc123abc123abc12');
        }
      );
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        startMultisig
      );
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
    });

    it('can change multisig addres the same', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
    });
  });

  describe('init tests', function () {
    it('should throw when no-contract call', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
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
        'try to set multisig',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'init',
                args: [
                  { type: 'string', value: base58Encode(user.address) },
                  { type: 'integer', value: 0 },
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
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenNotInitialized: revert',
        async () => {
          await init('jopa', 0);
        }
      );
    });

    // eslint-disable-next-line prettier/prettier
    it("should throw when invalid pauser's address", async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid pauser',
        async () => {
          await init('123abc', 0);
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when chainID less than 0', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid call chain id',
        async () => {
          await init(user.address, -1);
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when chainID more than MAX_INT', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid call chain id',
        async () => {
          await init(user.address, '9223372036854775808');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await step('call init', async () => {
        await init(user.address, 0);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(
          user.address
        );
        expect(
          await getDataValue(contract, 'CALL_CHAIN_ID', env.network, -1)
        ).to.be.equal(0);
      });
    });

    it('simple positive with max chainID value', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await step('call init', async () => {
        await init(user.address, '9223372036854775807');
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(
          user.address
        );
        expect(
          String(await getDataValue(contract, 'CALL_CHAIN_ID', env.network, -1))
        ).to.be.equal('9223372036854775807');
      });
    });

    it('should throw when not confirmed transaction', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
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
        'try to set multisig',
        'Transaction is not allowed by account-script',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'init',
                args: [
                  { type: 'string', value: base58Encode(user.address) },
                  { type: 'integer', value: 0 },
                ],
              },
            },
            contract.privateKey,
            env.network
          );
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
      });
    });
  });

  describe('allow tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to allow address',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'allow',
                args: [{ type: 'string', value: base58Encode(user.address) }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to allow address',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await allow(user.address);
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('should throw when incorrect allowed address', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to allow address',
        'Error while executing dApp: allow: invalid caller arg',
        async () => {
          await allow('abc999');
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await step('allow calling for user', async () => {
        await allow(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
      });
    });

    it('can allow the same address', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('allow calling for user', async () => {
        await allow(user.address);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
      });
    });

    it('can allow many addresses', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const user3 = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await step('allow calling for 1st user', async () => {
        await allow(user.address);
      });
      await step('allow calling for 2nd user', async () => {
        await allow(user2.address);
      });
      await step('allow calling for 3rd user', async () => {
        await allow(user3.address);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user2.address}`,
            env.network
          )
        ).is.true;
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user3.address}`,
            env.network
          )
        ).is.true;
      });
    });
  });

  describe('disallow tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to disallow address',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'disallow',
                args: [{ type: 'string', value: base58Encode(user.address) }],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to disallow address',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await disallow(user.address);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
      });
    });

    it('should throw when incorrect disallowed address', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to disallow address',
        'Error while executing dApp: disallow: invalid caller arg',
        async () => {
          await disallow('abc999');
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('disallow calling for user', async () => {
        await disallow(user.address);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('can disable unknow user', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('jack', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
          ],
        });
      });
      await step('disallow calling for user', async () => {
        await disallow(user2.address);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.true;
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user2.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('can disable disabled user', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
          ],
        });
      });
      await step('disallow calling for user', async () => {
        await disallow(user.address);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
      });
    });

    it('can disable all users', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user2.address}`,
              type: 'boolean',
              value: true,
            },
          ],
        });
      });
      await step('disallow calling for all users', async () => {
        await disallow(user.address);
        await disallow(user2.address);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user.address}`,
            env.network
          )
        ).is.false;
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(
            contract,
            `ALLOWANCE__${user2.address}`,
            env.network
          )
        ).is.false;
      });
    });
  });

  describe('updatePauser tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        // eslint-disable-next-line prettier/prettier
        "try to update pauser's address",
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'updatePauser',
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
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        // eslint-disable-next-line prettier/prettier
        "try to update pauser's address",
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await updatePauser(user.address);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    /**
     * MEMO: maybe update error message for wrong pauser address?
     */
    // eslint-disable-next-line prettier/prettier
    it("should throw when invalid pauser's address", async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        // eslint-disable-next-line prettier/prettier
        "try to update pauser's address",
        'Error while executing dApp: init: invalid pauser',
        async () => {
          await updatePauser('');
        }
      );
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      // eslint-disable-next-line prettier/prettier
      await step("update pauser's address", async () => {
        await updatePauser(user.address);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(
          user.address
        );
      });
    });

    it('can set the same pauser', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSER', type: 'string', value: '' },
          ],
        });
      });
      // eslint-disable-next-line prettier/prettier
      await step("update pauser's address", async () => {
        await updatePauser(user.address);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(
          user.address
        );
      });
      // eslint-disable-next-line prettier/prettier
      await step("update pauser's address again", async () => {
        await updatePauser(user.address);
      });
      await step('check state again', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(
          user.address
        );
      });
    });
  });

  describe('pause tests', function () {
    it('should throw when call non-pauser', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: false },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await stepIgnoreErrorByMessage(
        'try to pause',
        'Error while executing dApp: _onlyPauser: revert',
        async () => {
          await pause(user);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.false;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('prepare for update pauser', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: true }],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSED', type: 'boolean', value: false },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to pause',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await pause(pauser);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.false;
      });
    });

    it('should throw when paused', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: true },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await stepIgnoreErrorByMessage(
        'try to pause',
        'Error while executing dApp: _whenNotPaused: revert',
        async () => {
          await pause(pauser);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.true;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: false },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await step('call pause', async () => {
        await pause(pauser);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.true;
      });
    });
  });

  describe('unpause tests', function () {
    it('should throw when call non-pauser', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: true },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await stepIgnoreErrorByMessage(
        'try to unpause',
        'Error while executing dApp: _onlyPauser: revert',
        async () => {
          await unpause(user);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.true;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('prepare for update pauser', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: true }],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSED', type: 'boolean', value: true },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to unpause',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await unpause(pauser);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.true;
      });
    });

    it('should throw when not paused', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: false },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await stepIgnoreErrorByMessage(
        'try to unpause',
        'Error while executing dApp: _whenPaused: revert',
        async () => {
          await unpause(pauser);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.false;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: true },
          ],
        });
      });
      await step('set pauser', async () => {
        await updatePauser(pauser.address);
      });
      await step('call unpause', async () => {
        await unpause(pauser);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSED', env.network)).is.false;
      });
    });
  });

  describe('call tests', function () {
    it('should throw when not initialized', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
            { key: 'EVENT_SIZE', type: 'integer', value: 0 },
            { key: 'NONCE', type: 'integer', value: 0 },
            { key: 'EVENT__0', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to call',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await call(0, 'execution contract', 'calldata', user);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(0);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          0
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__0', env.network, '')).is
          .empty;
      });
    });

    it('should throw when not allowed caller', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${user.address}`,
              type: 'boolean',
              value: false,
            },
            { key: 'EVENT_SIZE', type: 'integer', value: 1 },
            { key: 'NONCE', type: 'integer', value: 1 },
            { key: 'EVENT__1', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to call',
        'Error while executing dApp: _whenAllowed: revert',
        async () => {
          await call(0, 'execution contract', 'calldata', user);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(1);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          1
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__1', env.network, '')).is
          .empty;
      });
    });

    it('should throw when self-call (and contract mot in allowed list)', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${contract.dApp}`,
              type: 'boolean',
              value: false,
            },
            { key: 'EVENT_SIZE', type: 'integer', value: 1366 },
            { key: 'NONCE', type: 'integer', value: 1366 },
            { key: 'EVENT__1366', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to call',
        'Error while executing dApp: _whenAllowed: revert',
        async () => {
          await selfCall(0, 'execution contract', 'calldata');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(1366);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          1366
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__1366', env.network, '')).is
          .empty;
      });
    });

    it('should throw when paused', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: true },
            { key: 'EVENT_SIZE', type: 'integer', value: 1234567890 },
            { key: 'NONCE', type: 'integer', value: 1234567890 },
            { key: 'EVENT__1234567890', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to call',
        'Error while executing dApp: _whenNotPaused: revert',
        async () => {
          await call(0, 'execution contract', 'calldata', user);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(1234567890);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          1234567890
        );
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT__1234567890', env.network, '')
        ).is.empty;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: false },
            { key: 'EVENT_SIZE', type: 'integer', value: 123 },
            { key: 'NONCE', type: 'integer', value: 123 },
            { key: 'CALL_CHAIN_ID', type: 'integer', value: 0 },
          ],
        });
      });
      await step('call', async () => {
        await call(0, 'execution contract_', 'calldata', user);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(124);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          124
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__123', env.network))
          // eslint-disable-next-line prettier/prettier
          .to.be.equal(
            `0__0__${user.address}__execution contract___calldata__123`
          );
      });
    });

    it('can create the same events', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `ALLOWANCE__${user.address}`, type: 'boolean', value: true },
            { key: 'PAUSED', type: 'boolean', value: false },
            { key: 'EVENT_SIZE', type: 'integer', value: 123 },
            { key: 'NONCE', type: 'integer', value: 321 },
            { key: 'CALL_CHAIN_ID', type: 'integer', value: 0 },
          ],
        });
      });
      await step('call', async () => {
        await call(0, 'execution contract_', 'calldata', user);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(124);
      });
      await step('call again with the same data', async () => {
        await call(0, 'execution contract_', 'calldata', user);
      });
      await step('check state again', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(125);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          323
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__124', env.network))
          // eslint-disable-next-line prettier/prettier
          .to.be.equal(
            `0__0__${user.address}__execution contract___calldata__322`
          );
      });
    });

    it('can self-call when allowed', async () => {
      const contract = getContractByName('evm_caller', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techContract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            {
              key: `ALLOWANCE__${contract.dApp}`,
              type: 'boolean',
              value: true,
            },
            { key: 'PAUSED', type: 'boolean', value: false },
            { key: 'EVENT_SIZE', type: 'integer', value: 0 },
            { key: 'NONCE', type: 'integer', value: 0 },
            { key: 'CALL_CHAIN_ID', type: 'integer', value: 0 },
          ],
        });
      });
      await step('call', async () => {
        await selfCall(0, 'execution contract_', 'calldata');
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'EVENT_SIZE', env.network)
        ).to.be.equal(1);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'NONCE', env.network)).to.be.equal(
          1
        );
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'EVENT__0', env.network))
          // eslint-disable-next-line prettier/prettier
          .to.be.equal(
            `0__0__${contract.dApp}__execution contract___calldata__0`
          );
      });
    });
  });
});

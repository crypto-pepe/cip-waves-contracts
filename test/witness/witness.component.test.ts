import {
  getAccountByName,
  getAssetByName,
  getBalance,
  getContractByName,
  getDataValue,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { expect } from 'chai';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { getEnvironment } from 'relax-env-json';
import {
  addProxySecurityDeposit,
  defaultAmt,
  init,
  publishWavesEventStatus,
  setActiveWitnesses,
  setMultisig,
  submitWavesCallEvent,
  subProxySecurityDeposit,
} from '../../steps/witness';
import { base58Encode, keccak, stringToBytes } from '@waves/ts-lib-crypto';
import {
  concatenateBytes,
  resetMintData,
  setSignedContext,
} from '../../steps/common';
import { array } from 'yargs';
const env = getEnvironment();

const SEPARATOR = '__';

/**
 * BUG:     1) [MINOR] we have an Int overflow in Int validation (_validateInt)
 *          3) [NORMAL] we can add all same witnesses
 * MEMO:    1) when we deploy contract we MUST call setMultisig AND init AND CHECK STATE!
 * SOLVED:  2) publishWavesEventStatus eventId_ can be more then last event index
 *          4) [CRITICAL] can't mint witness reward in publishWavesEventStatus
 */
describe('Witness component', function () {
  /**
   * REQUIRED: clear state
   */
  describe('before all special tests', async () => {
    it('[init] should throw when multisig not set', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      // eslint-disable-next-line prettier/prettier
      const customTokenAddress = getAccountByName('trinity', this.parent?.ctx).address;
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenMultisigSet: revert',
        async () => {
          await init(0, customTokenAddress, 0);
        }
      );
      await step('check INIT', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'INIT', env.network, false)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network, -1)).to.be.equal(-1);
      });
    });
  });

  describe('setMultisig tests', function () {
    // Need a clear state
    it('should throw when it is not self-call', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
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
      const contract = getContractByName('witness', this.parent?.ctx);
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
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
    });

    it('can change multisig addres the same', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
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
    it('should throw when no self-call', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
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
                  { type: 'integer', value: 0 },
                  { type: 'string', value: techConract.dApp },
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
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenNotInitialized: revert',
        async () => {
          await init(0, techConract.dApp, 0);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when proxySecDepoPerEvent less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid proxySecDepoPerEvent',
        async () => {
          await init(-1, techConract.dApp, 0);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when proxySecDepoPerEvent more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid proxySecDepoPerEvent',
        async () => {
          await init('9223372036854775808', techConract.dApp, 0);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when invalid token address', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardTokenAddress',
        async () => {
          await init(0, '', 0);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when rewardAmount less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardAmount',
        async () => {
          await init(0, techConract.dApp, -1);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when rewardAmount more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardAmount',
        async () => {
          await init(0, techConract.dApp, '9223372036854775808');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(-1);
      });
    });

    // TODO: check overflow
    it('simple positive', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: -1 },
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: '' },
            { key: 'REWARD_AMOUNT', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardAmount',
        async () => {
          await init(0, techConract.dApp, '9223372036854775807');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PROXY_SECURITY_DEPOSIT_PER_EVENT', env.network)).to.be.equal(0);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'REWARD_TOKEN_ADDRESS', env.network)).to.be.equal(techConract.dApp);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'REWARD_AMOUNT', env.network)).to.be.equal('9223372036854775807');
      });
    });
  });

  describe('setActiveWitnesses tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'setActiveWitnesses',
                args: [
                  { type: 'integer', value: 0 },
                  {
                    type: 'list',
                    value: [{ type: 'string', value: techConract.publicKey }],
                  },
                ],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await setActiveWitnesses(
            0,
            // eslint-disable-next-line prettier/prettier
            [{ type: 'string', value: techConract.publicKey }]
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    it('should throw when one wrong witness', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: setActiveWitnesses: invalid witnesses',
        async () => {
          await setActiveWitnesses(
            0,
            // eslint-disable-next-line prettier/prettier
            [{ type: 'string', value: 'jopa' }]
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    it('should throw when one of many witnesses wrong', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: setActiveWitnesses: invalid witnesses',
        async () => {
          await setActiveWitnesses(
            0,
            // eslint-disable-next-line prettier/prettier
            [
              { type: 'string', value: techConract.publicKey },
              { type: 'string', value: 'jopa' },
              { type: 'string', value: user.publicKey },
            ]
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    // MEMO: have no check
    xit('should throw when list of witnesses is empty', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: setActiveWitnesses: invalid witnesses',
        async () => {
          await setActiveWitnesses(
            0,
            // eslint-disable-next-line prettier/prettier
            []
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    // MEMO: have no check
    xit('should throw when witness list has duplicates', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set witness',
        'Error while executing dApp: setActiveWitnesses: invalid witnesses',
        async () => {
          await setActiveWitnesses(
            0,
            // eslint-disable-next-line prettier/prettier
            [
              { type: 'string', value: techConract.publicKey },
              { type: 'string', value: techConract.publicKey },
              { type: 'string', value: user.publicKey },
            ]
          );
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(0);
      });
    });

    it('can set one witness', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
          ],
        });
      });
      await step('set witnesses', async () => {
        // eslint-disable-next-line prettier/prettier
        await setActiveWitnesses(0, [{ type: 'string', value: techConract.publicKey }]);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(1);
        expect(
          await getDataValue(contract, 'WITNESSES_PER_EPOCH__0__1', env.network)
        ).to.be.equal(techConract.publicKey);
      });
    });

    it('can set 10 witnesses', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const chain = '9223372036854755807';
      const maxInt = '9223372036854755807';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: 'CURRENT_EPOCH__' + chain, type: 'integer', value: maxInt },
          ],
        });
      });
      await step('set witnesses', async () => {
        // eslint-disable-next-line prettier/prettier
        await setActiveWitnesses(
          chain,
          getRepeatedArray({ type: 'string', value: techConract.publicKey }, 10)
        );
      });
      await step('check state', async () => {
        const checkInt = '9223372036854755808';
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__' + chain, env.network)).to.be.equal(checkInt);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, 'WITNESSES_PER_EPOCH__' + chain + '__' + checkInt, env.network)
        ).to.be.equal(getWitnessesString(techConract.publicKey, 10));
      });
    });

    xit('can set 50 witnesses', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const chain = 0;
      const maxInt = 1366;
      const count = 11;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: 'CURRENT_EPOCH__' + chain, type: 'integer', value: maxInt },
          ],
        });
      });
      await step('set witnesses', async () => {
        // eslint-disable-next-line prettier/prettier
        await setActiveWitnesses(
          chain,
          // eslint-disable-next-line prettier/prettier
          getRepeatedArray({ type: 'string', value: techConract.publicKey }, count)
        );
      });
      await step('check state', async () => {
        const checkInt = maxInt + 1;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CURRENT_EPOCH__' + chain, env.network)).to.be.equal(checkInt);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, 'WITNESSES_PER_EPOCH__' + chain + '__' + checkInt, env.network)
        ).to.be.equal(getWitnessesString(techConract.publicKey, count));
      });
    });
  });

  describe('addProxySecurityDeposit tests', function () {
    it('should throw when invalid recipient', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const wrongUserAddr = 'ololo';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: -1 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${wrongUserAddr}`, type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addProxySecurityDeposit: invalid recipient',
        async () => {
          await addProxySecurityDeposit(wrongUserAddr, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(-1);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${wrongUserAddr}`, env.network)
        ).to.be.equal(-1);
      });
    });

    it('should throw when empty payment', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addProxySecurityDeposit: no payment',
        async () => {
          await addProxySecurityDeposit('', user, []);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(-1);
      });
    });

    it('should throw when payment contains more than 1 payment', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addProxySecurityDeposit: no payment',
        async () => {
          await addProxySecurityDeposit('', user, [
            { assetId: null, amount: 1366000000 },
            { assetId: null, amount: 66130000 },
          ]);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(-1);
      });
    });

    it('should throw when payment asset is not WAVES', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const USDN = getAssetByName('USDN', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addProxySecurityDeposit: invalid asset',
        async () => {
          await addProxySecurityDeposit('', user, [
            { assetId: USDN.assetId, amount: 1366000000 },
          ]);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(-1);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('add proxy security deposit', async () => {
        await addProxySecurityDeposit('', user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(defaultAmt);
      });
    });

    it('can send security deposit for other user', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const startBalance = 131300000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user2.address}`, type: 'integer', value: startBalance },
          ],
        });
      });
      await step('add proxy security deposit', async () => {
        await addProxySecurityDeposit(user2.address, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(0);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user2.address}`, env.network)
        ).to.be.equal(startBalance + defaultAmt);
      });
    });

    // BUG
    // eslint-disable-next-line prettier/prettier
    xit('can\'t overflow depo value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startBalance = '9223372036854755807';
      const endBalance = '9223372046854755807';
      const amount = 10000000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: startBalance },
          ],
        });
      });
      await step('add proxy security deposit', async () => {
        // eslint-disable-next-line prettier/prettier
        await addProxySecurityDeposit('', user, [{ assetId: null, amount: amount }]);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(endBalance);
      });
    });
  });

  // TODO: CHECK RACE CONDITION!
  describe('subProxySecurityDeposit tests', function () {
    it('should throw when balance less than request amount', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1359999999;
      const neededBalance = 1360000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to get security depo',
        'Error while executing dApp: subProxySecurityDeposit: insufficient balance',
        async () => {
          await subProxySecurityDeposit(neededBalance, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('should throw when unknown user', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
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
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to get security depo',
        'Error while executing dApp: subProxySecurityDeposit: insufficient balance',
        async () => {
          await subProxySecurityDeposit(1366000000, user2);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(0);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user2.address}`, env.network, 0)
        ).to.be.equal(0);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1366000000;
      const withdraw = 661300000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
          ],
        });
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('get security depo', async () => {
        await subProxySecurityDeposit(withdraw, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance - withdraw);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(user.address, env.network)).to.be.equal(startUserBalance - env.network.invokeFee + withdraw);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network))
          .to.be.equal(startContractBalance - withdraw);
      });
    });
  });

  // TODO: check max transaction count
  // MEMO: tests for MAX value positive because we have Int overflow to diapason less than zero
  describe('submitWavesCallEvent tests', function () {
    // eslint-disable-next-line prettier/prettier
    it('should throw when caller\'s chain ID less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 101 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid callerChainId',
        async () => {
          await submitWavesCallEvent(
            -1,
            -2,
            123,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash101',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when caller\'s chain ID more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 102 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid callerChainId',
        async () => {
          await submitWavesCallEvent(
            '9223372036854775808',
            -2,
            123,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash102',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when execution chain ID less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 103 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid executionChainId',
        async () => {
          await submitWavesCallEvent(
            0,
            -1,
            123,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash103',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when execution chain ID more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 104 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid executionChainId',
        async () => {
          await submitWavesCallEvent(
            0,
            '9223372036854775808',
            123,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash104',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when nonce less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 105 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid nonce',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            -1,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash105',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when nonce more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 106 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid nonce',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            '9223372036854775808',
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash106',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('should throw when caller is empty', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 107 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid caller',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            '',
            'execution contract',
            'function name',
            [],
            'txHash107',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('should throw when execution contract is empty', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 108 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid executionContract',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            'caller',
            '',
            'function name',
            [],
            'txHash108',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('should throw when function name is empty', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 109 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid functionName',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            'caller',
            'execution contract',
            '',
            [],
            'txHash109',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('should throw when tx hash is empty', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 110 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid txHash',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            'caller',
            'execution contract',
            'function name',
            [],
            '',
            1366,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when block number less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 111 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid blockNumber',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash111',
            -1,
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when block number more than max value', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 112 },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit WavesCall event',
        'Error while executing dApp: submitWavesCallEvent: invalid blockNumber',
        async () => {
          await submitWavesCallEvent(
            0,
            0,
            0,
            'caller',
            'execution contract',
            'function name',
            [],
            'txHash112',
            '9223372036854775808',
            user
          );
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      const hash = base58Encode(
        keccak(
          concatenateBytes([
            new Uint8Array(8), // RIDE Int 0
            new Uint8Array(8),
            new Uint8Array(8),
            stringToBytes('caller'),
            stringToBytes('executionContract'),
            stringToBytes('functionName'),
            stringToBytes(''),
            stringToBytes('txHash'),
            new Uint8Array(8),
          ])
        )
      );
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_CALLER__0__SIZE', type: 'integer', value: 0 },
          ],
        });
      });
      await step('submit WavesCall event', async () => {
        await submitWavesCallEvent(
          0,
          0,
          0,
          'caller',
          'executionContract',
          'functionName',
          [],
          'txHash',
          0,
          user
        );
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance - eventDepo);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'WAVES_EVENT__0', env.network))
          // eslint-disable-next-line prettier/prettier
          .to.be.equal(`0__0__0__caller__executionContract__functionName____txHash__0__${hash}__0__0__${eventDepo}__${user.address}`);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, `WAVES_EVENT_STATUS__${hash}`, env.network)).to.be.equal(1);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'WAVES_EVENT_SIZE', env.network)).to.be.equal(1);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'WAVES_EVENT_CALLER__0__0', env.network)).to.be.equal(0);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'WAVES_EVENT_CALLER__0__SIZE', env.network)).to.be.equal(1);
      });
    });

    it('should throw when duplicate event', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 66 },
            { key: 'WAVES_EVENT_CALLER__0__SIZE', type: 'integer', value: 13 },
          ],
        });
      });
      await step('submit WavesCall event', async () => {
        await submitWavesCallEvent(
          3,
          2,
          1,
          'caller',
          'executionContract',
          'functionName',
          [],
          'txHash001',
          13,
          user
        );
      });
      await stepIgnoreErrorByMessage(
        'try to submit the same WavesCall event again',
        'Error while executing dApp: submitWavesCallEvent: already exists',
        async () => {
          await submitWavesCallEvent(
            3,
            2,
            1,
            'caller',
            'executionContract',
            'functionName',
            [],
            'txHash001',
            13,
            user
          );
        }
      );
    });

    it('should throw when updated security deposit less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const eventDepo = 1000000001;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'PROXY_SECURITY_DEPOSIT_PER_EVENT', type: 'integer', value: eventDepo },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 13 },
            { key: 'WAVES_EVENT_CALLER__0__SIZE', type: 'integer', value: 66 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit the same WavesCall event again',
        'Error while executing dApp: submitWavesCallEvent: no security deposit',
        async () => {
          await submitWavesCallEvent(
            1,
            2,
            3,
            'caller',
            'executionContract',
            'functionName',
            [],
            'txHash00123',
            66,
            user
          );
        }
      );
    });
  });

  describe('publishWavesEventStatus tests', function () {
    it('should throw when event idx less than 0', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = -1;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: 2 },
            // { key: 'WAVES_EVENT_PUBLISHED__${pubKey}__${idx}', type: 'integer', value: 1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: invalid event idx',
        async () => {
          await publishWavesEventStatus(idx, 1, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${idx}`, env.network, -3)
        ).to.be.equal(-3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${idx * idx}`, env.network, -3)
        ).to.be.equal(-3);
      });
    });

    it('should throw when event idx equal eventSize or more', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 101;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${idx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: invalid event idx',
        async () => {
          await publishWavesEventStatus(idx, 1, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${idx}`, env.network)
        ).to.be.equal(0);
      });
    });

    it('should throw when status not in diapazon (less than PROCESSING)', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 102;
      const eventIdx = idx - 2;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: invalid status',
        async () => {
          await publishWavesEventStatus(eventIdx, 0, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
      });
    });

    it('should throw when status not in diapazon (more than REJECTED)', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 103;
      const eventIdx = idx - 2;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: invalid status',
        async () => {
          await publishWavesEventStatus(eventIdx, 4, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
      });
    });

    it('should throw when caller not in witness list', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('thomas', this.parent?.ctx);
      const idx = 104;
      const eventIdx = idx - 2;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: invalid caller',
        async () => {
          await publishWavesEventStatus(eventIdx, 2, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
      });
    });

    it('should throw when event already confirmed', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 105;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash001';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__100000000__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 2 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: user.publicKey },
        ]);
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: event already confirmed',
        async () => {
          await publishWavesEventStatus(eventIdx, 3, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(2);
      });
    });

    it('should throw when event already rejected', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 106;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash002';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__100000000__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 3 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: user.publicKey },
        ]);
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: event already confirmed',
        async () => {
          await publishWavesEventStatus(eventIdx, 2, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(3);
      });
    });

    it('should throw when event already published', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 107;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash003';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__100000000__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 1 },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: user.publicKey },
        ]);
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: already published',
        async () => {
          await publishWavesEventStatus(eventIdx, 2, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(1);
      });
    });

    it('should throw when publish event status = EVENT_STATUS_PROCESSING', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const idx = 108;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash004';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__100000000__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: user.publicKey },
        ]);
      });
      await stepIgnoreErrorByMessage(
        'try to publish WavesCall event',
        'Error while executing dApp: publishWavesEventStatus: incorrect status',
        async () => {
          await publishWavesEventStatus(eventIdx, 1, user);
        }
      );
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(0);
      });
    });

    it('simple positive event confirmed without quorum', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const idx = 1001;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1001';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__${depo}__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: contract.publicKey },
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 2, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(2);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__1__1__${depo}__${user.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    // MEMO: check not only reject but impossibility of PROCESSING status in quorum too
    it('simple positive event rejected without quorum', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const idx = 1002;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1002';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__${depo}__${user.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
          ],
        });
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: contract.publicKey },
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 3, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__1__${depo}__${user.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    it('event finalization when event is confirmed', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const reward = 123456789;
      const idx = 1003;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1003';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__1__1__${depo}__${user2.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user2.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user2.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: techConract.publicKey },
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      // eslint-disable-next-line prettier/prettier
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 2, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(2);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(2);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__2__2__${depo}__${user2.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user2.address}`, env.network)
        ).to.be.equal(availBalance + depo);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        // console.info(`WITNESS_1: ${await getDataValue(techConract, 'WITNESS_1', env.network)}`);
        // console.info(`WITNESS_2: ${await getDataValue(techConract, 'WITNESS_2', env.network)}`);
        // console.info(`WITNESS_3: ${await getDataValue(techConract, 'WITNESS_3', env.network)}`);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(user2.address);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(techConract.dApp);
        expect(
          await getDataValue(techConract, 'WITNESS_3', env.network)
        ).to.be.equal(user.address);
      });
    });

    it('event finalization when event is rejected', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const user3 = getAccountByName('trinity', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const reward = 123456789;
      const idx = 1003;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1003';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__1__${depo}__${user2.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user2.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user2.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: techConract.publicKey },
          { type: 'string', value: user3.publicKey },
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      // eslint-disable-next-line prettier/prettier
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 3, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__2__${depo}__${user2.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - depo);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance + depo);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(user2.address);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(techConract.dApp);
        expect(
          await getDataValue(techConract, 'WITNESS_3', env.network)
        ).to.be.equal(user3.address);
      });
    });

    it('confirm event with alone witness', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const reward = 123456789;
      const idx = 1003;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1003';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__0__${depo}__${user2.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user2.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user2.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      // eslint-disable-next-line prettier/prettier
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 2, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(2);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(2);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__1__1__${depo}__${user2.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user2.address}`, env.network)
        ).to.be.equal(availBalance + depo);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(user2.address);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(user.address);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(techConract, 'WITNESS_3', env.network)).is.empty;
      });
    });

    it('reject event with two witnesses', async () => {
      const contract = getContractByName('witness', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const availBalance = 1000000000;
      const depo = 100000000;
      const reward = 123456789;
      const idx = 1003;
      const eventIdx = idx - 2;
      const eventHash = 'eventHash1003';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'WAVES_EVENT_SIZE', type: 'integer', value: idx },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT__${eventIdx}`, type: 'string', value: `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__1__${depo}__${user2.address}` },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_STATUS__${eventHash}`, type: 'integer', value: 1 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `WAVES_EVENT_PUBLISHED__${user2.publicKey}__${eventIdx}`, type: 'integer', value: 0 },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: `PROXY_SECURITY_DEPOSIT__${user2.address}`, type: 'integer', value: availBalance },
            // eslint-disable-next-line prettier/prettier
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set witness', async () => {
        await setActiveWitnesses(0, [
          { type: 'string', value: techConract.publicKey },
          { type: 'string', value: user.publicKey },
        ]);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      // eslint-disable-next-line prettier/prettier
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      await step('publish WavesCall event', async () => {
        await publishWavesEventStatus(eventIdx, 3, user);
      });
      await step('check state', async () => {
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_PUBLISHED__${user.publicKey}__${eventIdx}`, env.network)
        ).to.be.equal(3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT_STATUS__${eventHash}`, env.network)
        ).to.be.equal(3);
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `WAVES_EVENT__${eventIdx}`, env.network)
        ).to.be.equal(
          `0__0__0__caller__executionContract__functionName____txHash__0__${eventHash}__0__2__${depo}__${user2.address}`
        );
        expect(
          // eslint-disable-next-line prettier/prettier
          await getDataValue(contract, `PROXY_SECURITY_DEPOSIT__${user.address}`, env.network)
        ).to.be.equal(availBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - depo);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance + depo);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(user2.address);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(techConract.dApp);
        expect(
          await getDataValue(techConract, 'WITNESS_3', env.network)
        ).to.be.equal(user.address);
      });
    });
  });
});

function getRepeatedArray(key_: any, count_: number): any[] {
  const arr = [];
  // eslint-disable-next-line prettier/prettier
  for(let i = 0; i < count_; i++) {
    arr.push(key_);
  }
  return arr;
}

function getWitnessesString(witness_: string, count_: number) {
  let witnesses = '';
  for (let i = 0; i < count_; i++) {
    if (witnesses.length > 0) {
      witnesses = witnesses + SEPARATOR;
    }
    witnesses = witnesses + witness_;
  }
  return witnesses;
}

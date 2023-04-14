/* eslint-disable prettier/prettier */
import {
  getAccountByName,
  getAssetByName,
  getBalance,
  getBlockHeight,
  getContractByName,
  getDataValue,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { expect } from 'chai';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { getEnvironment } from 'relax-env-json';
import { addSecurityDeposit, init, reset, setActiveSigners, setMultisig, submitR, submitS, subSecurityDeposit } from '../../steps/signer';
import { base16Encode, base58Decode, base58Encode, base64Encode, keccak, randomBytes, signBytes, stringToBytes } from '@waves/ts-lib-crypto';
import { concatenateBytes, numToUint8Array, resetMintData, setEventDataMock, setEventMock, setEventTypeMock, setSignedContext } from '../../steps/common';
const env = getEnvironment();

/**
 * BUGS:    1) [MINOR] Writing 2 same signers but LOCKS is = 1
 *          2) [MINOR] Possible to withdraw security depo when contract not initialized
 *          3) [MINOR] We can add all same signers
 *          7) [MINOR] Not Math.round punishment as reward in reset()
 *          8) [MINOR] There is int owerflow which not detected anywhere
 *          9) [MINOR] Doesn't have UNLOCK functionality
 *          10) [NORMAL] Doesn't check EVM signature
 * 
 * MEMO:    1) check reset and next sign on integration
 * 
 * SOLVED:  5) [MAJOR] timeout works inversion (till delta height)
 *          6) [NORMAL] need to clean all of s and r parts (for signers) per epoch
 *          4) [CRITICAL] s array not cleared on reset()
 */
describe('Signer component', function () {
  /**
   * REQUIRED: clear state
   */
  xdescribe('before all special tests', async () => {
    it('[init] should throw when multisig not set', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      // eslint-disable-next-line prettier/prettier
      const customTokenAddress = getAccountByName('trinity', this.parent?.ctx).address;
      const witnessAddress = getAccountByName('max', this.parent?.ctx).address;
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenMultisigSet: revert',
        async () => {
          await init(0, 0, 0, customTokenAddress, 0, witnessAddress);
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
    xit('should throw when it is not self-call', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
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
      const contract = getContractByName('signer', this.parent?.ctx);
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
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
    });

    it('can change multisig addres the same', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
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
    it('should throw when not self-call', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
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
        'try to init',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'init',
                args: [
                  { type: 'integer', value: 0 },
                  { type: 'integer', value: 0 },
                  { type: 'integer', value: 0 },
                  { type: 'string', value: techConract.dApp },
                  { type: 'integer', value: 0 },
                  { type: 'string', value: techConract.dApp },
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
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set init value = true', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenNotInitialized: revert',
        async () => {
          await init(0, 0, 0, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when minimal security deposit less than punishment', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid minSecDepo',
        async () => {
          await init(0, 1, 0, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when minimal security deposit more than max int value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid minSecDepo',
        async () => {
          await init('9223372036854775808', 1, 0, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when punishment less than zero', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid punishment',
        async () => {
          await init(0, -1, 0, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    // MEMO: test trick in punishment overflow
    it('should throw when punishment more than max int value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid punishment',
        async () => {
          await init(0, '9223372036854775808', 0, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when reset block delta less than zero', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid resetBlockDelta',
        async () => {
          await init(0, 0, -1, techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when reset block delta more than max int value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid resetBlockDelta',
        async () => {
          await init(0, 0, '9223372036854775808', techConract.dApp, 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when wrong reward token address', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardTokenAddress',
        async () => {
          await init(0, 0, 0, 'abc321', 0, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when reward amount less than zero', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardAmount',
        async () => {
          await init(0, 0, 0, techConract.dApp, -1, techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when reward amount more than max int value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid rewardAmount',
        async () => {
          await init(0, 0, 0, techConract.dApp, '9223372036854775808', techConract.dApp);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('should throw when wrong witness address', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: init: invalid witnessAddress',
        async () => {
          await init(0, 0, 0, techConract.dApp, 0, '');
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(-1);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const secDepo = 1366;
      const punishment = 33;
      const resetDelta = 131;
      const rewardAmt = 12321;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            // eslint-disable-next-line prettier/prettier
            { key: 'MIN_SEC_DEPO', type: 'integer', value: -1 },
          ],
        });
      });
      await step('init contract', async () => {
        // eslint-disable-next-line prettier/prettier
        await init(secDepo, punishment, resetDelta, techConract.dApp, rewardAmt, techConract.dApp);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'MIN_SEC_DEPO', env.network)).to.be.equal(secDepo);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PUNISHMENT', env.network)).to.be.equal(punishment);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'RESET_BLOCK_DELTA', env.network)).to.be.equal(resetDelta);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'REWARD_TOKEN_ADDRESS', env.network)).to.be.equal(techConract.dApp);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'REWARD_AMOUNT', env.network)).to.be.equal(rewardAmt);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'WINTESS_ADDRESS', env.network)).to.be.equal(techConract.dApp);
      });
    });
  });

  describe('setActiveSigners tests', function () {
    it('should throw when no self-caller', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'setActiveSigners',
                args: [
                  { type: 'integer', value: 0 },
                  { type: 'list', value: [
                    { type: 'string', value: techConract.dApp },
                  ]},
                  { type: 'integer', value: 1 },
                  { type: 'string', value: '' },
                ],
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await setActiveSigners(0, [{ type: 'string', value: '' }], 1, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    // MEMO: better if this check will has own error message
    // eslint-disable-next-line prettier/prettier
    it('should throw when empty signer\'s list', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid T',
        async () => {
          await setActiveSigners(0, [], 2, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when in list alone wrong signer\'s address', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid signers',
        async () => {
          await setActiveSigners(0, [{ type: 'string', value: '121bcb' }], 1, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    it('should throw when in list of 10 signers one wrong', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid signers',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: '121bcb' },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 1, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    it('should throw when t < 2', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid T',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 1, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when t = 2 but signer\'s list size = 1', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid T',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 2, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
      });
    });

    it('should throw when t > signer\'s list size', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid T',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 3, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(1);
      });
    });

    it('should throw when signerPublicKey is empty', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid signerGroupPublicKey',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 2, '');
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(1);
      });
    });

    it('should throw when signerPublicKey contains separator', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to set active signers',
        'Error while executing dApp: setActiveSigners: invalid signerGroupPublicKey',
        async () => {
          await setActiveSigners(0, [
            { type: 'string', value: base58Encode(techConract.publicKey) },
            { type: 'string', value: base58Encode(techConract.publicKey) },
          ], 2, `${techConract.publicKey}__${techConract.publicKey}`);
        }
      );
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network)).is.empty;
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(1);
      });
    });

    // MEMO: LOCKS__pubkey ONLY INCREMENTS NOW!!! Waiting for unlocking functionality
    // BUG! Writing 2 same signers but LOCKS is = 1
    it('simple positive', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 1 },
            { key: 'SIGNERS_PER_EPOCH__0__2', type: 'string', value: '' },
          ],
        });
      });
      await step('set active signers', async () => {
        await setActiveSigners(0, [
          { type: 'string', value: base58Encode(techConract.publicKey) },
          { type: 'string', value: base58Encode(techConract.publicKey) },
        ], 2, techConract.publicKey);
      });
      await step('check INIT', async () => {
        expect(await getDataValue(contract, 'CURRENT_EPOCH__0', env.network)).to.be.equal(2);
        expect(await getDataValue(contract, 'T__0__2', env.network)).to.be.equal(2);
        expect(await getDataValue(contract, 'SIGNERS_PER_EPOCH__0__2', env.network))
          .to.be.equal(`${techConract.publicKey}__${techConract.publicKey}`);
        // BUG-FEATURE HERE
        // expect(await getDataValue(contract, `LOCKS__${techConract.publicKey}`, env.network)).to.be.equal(2);
      });
    });
  });

  describe('addSecurityDeposit tests', function () {
    it('should throw when invalid recipient address', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: 0 },
            { key: 'SEC_DEPO__abc450', type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addSecurityDeposit: invalid recipient',
        async () => {
          await addSecurityDeposit('abc450', [{ assetId: null, amount: 1366 }], user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(0);
        expect(await getDataValue(contract, 'SEC_DEPO__abc450', env.network)).to.be.equal(0);
      });
    });

    it('should throw when no payments', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addSecurityDeposit: no payment',
        async () => {
          await addSecurityDeposit('', [], user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(0);
      });
    });

    it('should throw when more than one payment in transaction', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addSecurityDeposit: no payment',
        async () => {
          await addSecurityDeposit('', [
            { assetId: null, amount: 1366 },
            { assetId: null, amount: 6613 },
          ], user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(0);
      });
    });

    it('should throw when not WAVES in payment', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
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
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to add security depo',
        'Error while executing dApp: addSecurityDeposit: invalid asset',
        async () => {
          await addSecurityDeposit('', [{ assetId: USDN.assetId, amount: 1366 }], user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(0);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('add security depo', async () => {
        await addSecurityDeposit('', [{ assetId: null, amount: secDepo }], user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(secDepo);
      });
      await step('check contract balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance + secDepo);
      });
    });

    it('can add more security depo', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('add security depo', async () => {
        await addSecurityDeposit('', [{ assetId: null, amount: secDepo }], user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(2 * secDepo);
      });
      await step('check contract balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance + secDepo);
      });
    });

    it('can add security depo for other user', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const bro = getAccountByName('morpheus', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
            { key: `SEC_DEPO__${bro.address}`, type: 'integer', value: 0 },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step('add security depo', async () => {
        await addSecurityDeposit(bro.address, [{ assetId: null, amount: secDepo }], user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(secDepo);
        expect(await getDataValue(contract, `SEC_DEPO__${bro.address}`, env.network)).to.be.equal(secDepo);
      });
      await step('check contract balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance + secDepo);
      });
    });
  });

  describe('subSecurityDeposit tests', function () {
    it('should throw when security depo is locked', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
            { key: `LOCKS__${user.publicKey}`, type: 'integer', value: 1 },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await stepIgnoreErrorByMessage(
        'try to give back security depo',
        'Error while executing dApp: subSecurityDeposit: locked',
        async () => {
          await subSecurityDeposit(secDepo, user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(secDepo);
      });
      await step('check balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    it('should throw when insufficient balance', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
            { key: `LOCKS__${user.publicKey}`, type: 'integer', value: 0 },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await stepIgnoreErrorByMessage(
        'try to give back security depo',
        'Error while executing dApp: subSecurityDeposit: insufficient balance',
        async () => {
          await subSecurityDeposit(secDepo + 1, user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(secDepo);
      });
      await step('check balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const secDepo = 1366000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
            { key: `LOCKS__${user.publicKey}`, type: 'integer', value: 0 },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startUserBalance = await getBalance(user.address, env.network);
      await stepIgnoreErrorByMessage(
        'try to give back security depo',
        'Error while executing dApp: subSecurityDeposit: insufficient balance',
        async () => {
          await subSecurityDeposit(secDepo, user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(0);
      });
      await step('check balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - secDepo);
        expect(await getBalance(user.address, env.network)).to.be.equal(startUserBalance + secDepo - env.network.invokeFee);
      });
    });

    it('can give back sec depo if LOCK undefined', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('thomas', this.parent?.ctx);
      const secDepo = 1366000000;
      const delta = 661300000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: secDepo },
          ],
        });
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startUserBalance = await getBalance(user.address, env.network);
      await stepIgnoreErrorByMessage(
        'try to give back security depo',
        'Error while executing dApp: subSecurityDeposit: insufficient balance',
        async () => {
          await subSecurityDeposit(secDepo - delta, user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(delta);
      });
      await step('check balance', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - secDepo + delta);
        expect(await getBalance(user.address, env.network)).to.be.equal(startUserBalance + secDepo - delta - env.network.invokeFee);
      });
    });
  });

  describe('submitR tests', function () {
    it('should throw when not initialized', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    // MEMO: test trick in variable overflow and MAX INT
    it('should throw when event ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid eventId',
        async () => {
          await submitR(-1, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when execution chain ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid execChainId',
        async () => {
          await submitR(0, -1, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when empty r', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid r',
        async () => {
          await submitR(0, 0, '', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when r contains separator', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid r',
        async () => {
          await submitR(0, 0, 'R__', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event is not confirmed', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'WINTESS_ADDRESS', type: 'string', value: techConract.dApp },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, false, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: event not confirmed',
        async () => {
          await submitR(0, 0, 'R', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when signer not in list', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: `${techConract.publicKey}__${techConract.publicKey}` },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: not active',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when security depo less than min value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: `${user.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo - 1 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: not enough security deposit',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event status = SIGN', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: `${user.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 2 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid event status',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event status = DONE', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: `${user.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 3 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: invalid event status',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `R__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when r already submitted', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R__0__0', type: 'string', value: 'r' },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: 'r' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: `${user.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 1 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit R',
        'Error while executing dApp: submitR: already submitted',
        async () => {
          await submitR(0, 0, 'r', user);
        }
      );
    });

    it('simple positive without sign', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      const epoch = 1234;
      const eChainId = 10001;
      const eventId = 661312345678;
      const r = 'r001';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: '' },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: '' },
            { key: `R_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: '' },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${techConract.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 1 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `EVENT_START_BLOCK__${eChainId}__${eventId}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
      });
      await step('submit R', async () => {
        await submitR(eventId, eChainId, r, user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(1);
        expect(await getDataValue(contract, `EVENT_START_BLOCK__${eChainId}__${eventId}`, env.network)).to.be.equal(0);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R_SIGNERS__${eChainId}__${eventId}`, env.network)).to.be.equal(user.publicKey);
      });
    });

    it('re-submit R without sign', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      const epoch = 1234;
      const eChainId = 10001;
      const eventId = 661312345678;
      const r = 'r001';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: '' },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `R_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: '' },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${techConract.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 1 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `EVENT_START_BLOCK__${eChainId}__${eventId}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
      });
      await step('submit R', async () => {
        await submitR(eventId, eChainId, r, user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(1);
        expect(await getDataValue(contract, `EVENT_START_BLOCK__${eChainId}__${eventId}`, env.network)).to.be.equal(0);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R_SIGNERS__${eChainId}__${eventId}`, env.network)).to.be.equal(user.publicKey);
      });
    });

    it('can sign events ', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 1366136613;
      const epoch = 5678;
      const eChainId = 10001;
      const eventId = 6613;
      const r = 'r002';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: '' },
            { key: `R_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: techConract.publicKey },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${techConract.publicKey}__${user.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 1 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `EVENT_START_BLOCK__${eChainId}__${eventId}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
      });
      await step('submit R', async () => {
        await submitR(eventId, eChainId, r, user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(2);
        expect(await getDataValue(contract, `EVENT_START_BLOCK__${eChainId}__${eventId}`, env.network)).is.not.equal(0);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}`, env.network)).to.be.equal(`${r}__${r}`);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R_SIGNERS__${eChainId}__${eventId}`, env.network))
          .to.be.equal(`${techConract.publicKey}__${user.publicKey}`);
      });
    });
  });

  describe('submitS tests', function () {
    it('should throw when not initialized', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    // MEMO: trick like submitR
    it('should throw when event ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid eventId',
        async () => {
          await submitS(-1, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when execution chain ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid execChainId',
        async () => {
          await submitS(0, -1, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when r sigma is empty', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid r sigma',
        async () => {
          await submitS(0, 0, '', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when r sigma contains separator', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid r sigma',
        async () => {
          await submitS(0, 0, '__r', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when empty s', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid s',
        async () => {
          await submitS(0, 0, 'rsigma', '', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when s contains separator', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid s',
        async () => {
          await submitS(0, 0, 'rsigma', 's__s', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when caller is not in signer\'s list', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: not active',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    // MEMO: why need minSecDepo checking???
    it('should throw when security depo less than minimum value', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo - 1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: not enough security deposit',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event is not confirmed', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, false, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid event status',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event status = INIT', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 1 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid event status',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when event status = DONE', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 3 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: invalid event status',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when s already submitted', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: 's' },
            { key: 'S__0__0', type: 'string', value: 's' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 2 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: already submitted',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
    });

    it('should throw when r not exsists', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R__0__0', type: 'string', value: '' },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 2 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: R is not submitted',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('should throw when r not contains signer\'s r', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R__0__0', type: 'string', value: '' },
            { key: `R__0__0__${user.publicKey}`, type: 'string', value: 'r' },
            { key: `S__0__0__${user.publicKey}`, type: 'string', value: '' },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 2 },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(0, 0, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'try to submit S',
        'Error while executing dApp: submitS: R is not submitted',
        async () => {
          await submitS(0, 0, 'rsigma', 's', 'ssigma', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `S__0__0__${user.publicKey}`, env.network)).is.empty;
      });
    });

    it('simple positive without rising up event status to DONE', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      const eChainId = 20003;
      const epoch = 13661488;
      const eventId = 876543;
      const rSigma = 'rsigma';
      const s = 's';
      const r = 'ololo';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `S__${eChainId}__${eventId}`, type: null, value: null },
            { key: `S__${eChainId}__${eventId}__${user.publicKey}`, type: null, value: null },
            { key: `S_SIGNERS__${eChainId}__${eventId}`, type: null, value: null },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${user.publicKey}__${techConract.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 2 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `S_SIGMA__${eChainId}__${eventId}`, type: null, value: null },
            { key: `R_SIGMA__${eChainId}__${eventId}`, type: null, value: null },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
      });
      await step('submit S', async () => {
        await submitS(eventId, eChainId, rSigma, s, 'ololo', user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(2);
        expect(await getDataValue(contract, `S_SIGMA__${eChainId}__${eventId}`, env.network)).is.null;
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S_SIGNERS__${eChainId}__${eventId}`, env.network)).to.be.equal(user.publicKey);
        expect(await getDataValue(contract, `R_SIGMA__${eChainId}__${eventId}`, env.network)).to.be.equal(rSigma);
      });
    });

    it('can DONE event in EVM', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      const eChainId = 321;
      const epoch = 1488;
      const eventId = 1366;
      const rSigma = 'rsigma';
      const s = 's';
      const r = 'ololo';
      const sSigma = 'ssigma';
      const execIdx = 77;
      const reward = 66131366;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `S__${eChainId}__${eventId}`, type: 'string', value: s },
            { key: `S__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: '' },
            { key: `S_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: techConract.publicKey },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${user.publicKey}__${techConract.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 2 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `R_SIGMA__${eChainId}__${eventId}`, type: 'string', value: rSigma },
            { key: `S_SIGMA__${eChainId}__${eventId}`, type: null, value: null },
            { key: 'WINTESS_ADDRESS', type: 'string', value: techConract.dApp },
            // TOKEN SETTINGS
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
            { key: `SIGNED_EVENT_EXECUTOR__${eChainId}__SIZE`, type: 'integer', value: execIdx },
            { key: `SIGNED_EVENT_EXECUTOR__${eChainId}__${execIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
        await setEventTypeMock(eChainId, eventId, 'EVM', techConract);
        await setEventDataMock(eChainId, eventId, base16Encode(''), techConract);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      const startUserBalance = await getBalance(user.address, env.network);
      await step('submit S', async () => {
        await submitS(eventId, eChainId, rSigma, s, sSigma, user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(3);
        expect(await getDataValue(contract, `SIGNED_EVENT_EXECUTOR__${eChainId}__${execIdx}`, env.network))
          .to.be.equal(eventId);
        expect(await getDataValue(contract, `SIGNED_EVENT_EXECUTOR__${eChainId}__SIZE`, env.network))
          .to.be.equal(execIdx + 1);
        expect(await getDataValue(contract, `S_SIGMA__${eChainId}__${eventId}`, env.network)).to.be.equal(sSigma);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}`, env.network)).to.be.equal(`${s}__${s}`);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S_SIGNERS__${eChainId}__${eventId}`, env.network))
          .to.be.equal(`${techConract.publicKey}__${user.publicKey}`);
        expect(await getDataValue(contract, `R_SIGMA__${eChainId}__${eventId}`, env.network))
          .to.be.equal(rSigma);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(user.address, env.network)).to.be.equal(startUserBalance - env.network.invokeFee);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        console.info(`WITNESS_1: ${await getDataValue(techConract, 'WITNESS_1', env.network)}`);
        console.info(`WITNESS_2: ${await getDataValue(techConract, 'WITNESS_2', env.network)}`);
        console.info(`WITNESS_3: ${await getDataValue(techConract, 'WITNESS_3', env.network)}`);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(techConract.dApp);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(user.address);
        expect(
          await getDataValue(techConract, 'WITNESS_3', env.network)
        ).is.empty;
      });
    });

    it('can DONE event in WAVES', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      const cChainId = 10001;
      const eChainId = 321;
      const nonce = 2222;
      const funcName = 'nothing';
      const txHash = '12ab34cd';
      const epoch = 1488;
      const eventId = 1366;
      const s = 's';
      const r = 'ololo';
      const execIdx = 77;
      const reward = 66131366;
      // Sign
      const rawData = concatenateBytes(
        [
          numToUint8Array(cChainId),
          numToUint8Array(eChainId),
          numToUint8Array(nonce),
          numToUint8Array(txHash.length),
          stringToBytes(txHash),
          base58Decode(techConract.dApp),
          numToUint8Array(funcName.length),
          stringToBytes(funcName),
          numToUint8Array(1), // pseudolength for args (because array)
          new Uint8Array(8), // 0-idx el
        ]
      );
      const dataHash = keccak(rawData);
      const sign = base58Decode(signBytes(user.privateKey, dataHash));
      expect(sign.length).to.be.equal(64);
      const r_ = new Uint8Array(32);
      const s_ = new Uint8Array(32);
      for (let i = 0; i < 64; i++) {
        if (i < 32) {
          r_[i] = sign[i];
        } else {
          s_[i - 32] = sign[i];
        }
      }
      const rSigma = base58Encode(r_);
      const sSigma = base58Encode(s_);
      //
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `S__${eChainId}__${eventId}`, type: 'string', value: s },
            { key: `S__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: '' },
            { key: `S_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: techConract.publicKey },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${user.publicKey}__${techConract.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 2 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `R_SIGMA__${eChainId}__${eventId}`, type: 'string', value: rSigma },
            { key: `S_SIGMA__${eChainId}__${eventId}`, type: null, value: null },
            { key: 'WINTESS_ADDRESS', type: 'string', value: techConract.dApp },
            // SIGNER_GROUP_PUBLIC_KEY
            { key: `SIGNER_GROUP_PUBLIC_KEY__${eChainId}__${epoch}`, type: 'string', value: user.publicKey },
            // TOKEN SETTINGS
            { key: 'REWARD_TOKEN_ADDRESS', type: 'string', value: techConract.dApp },
            { key: 'REWARD_AMOUNT', type: 'integer', value: reward },
            { key: `SIGNED_EVENT_EXECUTOR__${eChainId}__SIZE`, type: 'integer', value: execIdx },
            { key: `SIGNED_EVENT_EXECUTOR__${eChainId}__${execIdx}`, type: 'integer', value: 0 },
          ],
        });
      });
      await step('reset mock state', async () => {
        await resetMintData(techConract);
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
        await setEventTypeMock(eChainId, eventId, 'WAVES', techConract);
        await setEventDataMock(eChainId, eventId, base16Encode(rawData), techConract);
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      const startUserBalance = await getBalance(user.address, env.network);
      await step('submit S', async () => {
        await submitS(eventId, eChainId, base58Encode(rSigma), s, base58Encode(sSigma), user);
      });
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(3);
        expect(await getDataValue(contract, `SIGNED_EVENT_EXECUTOR__${eChainId}__${execIdx}`, env.network))
          .to.be.equal(eventId);
        expect(await getDataValue(contract, `SIGNED_EVENT_EXECUTOR__${eChainId}__SIZE`, env.network))
          .to.be.equal(execIdx + 1);
        expect(await getDataValue(contract, `S_SIGMA__${eChainId}__${eventId}`, env.network)).to.be.equal(sSigma);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}`, env.network)).to.be.equal(`${s}__${s}`);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S_SIGNERS__${eChainId}__${eventId}`, env.network))
          .to.be.equal(`${techConract.publicKey}__${user.publicKey}`);
        expect(await getDataValue(contract, `R_SIGMA__${eChainId}__${eventId}`, env.network))
          .to.be.equal(rSigma);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance);
        // eslint-disable-next-line prettier/prettier
        expect(await getBalance(user.address, env.network)).to.be.equal(startUserBalance - env.network.invokeFee);
        expect(
          await getDataValue(techConract, 'MINT_AMOUNT', env.network)
        ).to.be.equal(reward);
        console.info(`WITNESS_1: ${await getDataValue(techConract, 'WITNESS_1', env.network)}`);
        console.info(`WITNESS_2: ${await getDataValue(techConract, 'WITNESS_2', env.network)}`);
        console.info(`WITNESS_3: ${await getDataValue(techConract, 'WITNESS_3', env.network)}`);
        expect(
          await getDataValue(techConract, 'WITNESS_1', env.network)
        ).to.be.equal(techConract.dApp);
        expect(
          await getDataValue(techConract, 'WITNESS_2', env.network)
        ).to.be.equal(user.address);
        expect(
          await getDataValue(techConract, 'WITNESS_3', env.network)
        ).is.empty;
      });
    });

    it('should throw when s sigma is empty', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const minSecDepo = 14881488;
      const eChainId = 321;
      const epoch = 1488;
      const eventId = 1366;
      const rSigma = 'rsigma';
      const s = 's';
      const r = 'ololo';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `S__${eChainId}__${eventId}`, type: 'string', value: s },
            { key: `S__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: '' },
            { key: `S_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: techConract.publicKey },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string', value: `${user.publicKey}__${techConract.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 2 },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 2 },
            { key: `R_SIGMA__${eChainId}__${eventId}`, type: 'string', value: rSigma },
            { key: `S_SIGMA__${eChainId}__${eventId}`, type: null, value: null },
          ],
        });
      });
      await step('set mock', async () => {
        await setEventMock(eChainId, eventId, true, techConract);
      });
      await stepIgnoreErrorByMessage(
        'set state',
        'Error while executing dApp: submitS: invalid s sigma',
        async () => {
          await submitS(eventId, eChainId, rSigma, s, '', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(2);
        expect(await getDataValue(contract, `S_SIGMA__${eChainId}__${eventId}`, env.network)).is.null;
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal('');
        expect(await getDataValue(contract, `S_SIGNERS__${eChainId}__${eventId}`, env.network)).to.be.equal(techConract.publicKey);
        expect(await getDataValue(contract, `R_SIGMA__${eChainId}__${eventId}`, env.network)).to.be.equal(rSigma);
      });
    });
  });

  describe('reset tests', function () {
    it('should throw when not initialized', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    // Trick with overflow
    it('should throw when event ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid eventId',
        async () => {
          await reset(-1, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when execution chain ID less than 0', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid execChainId',
        async () => {
          await reset(0, -1, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when r is empty', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid r',
        async () => {
          await reset(0, 0, '', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when caller is not in list of signers', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: not active',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when not enough security deposit', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      const minSecDepo = 13661488;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo - 1 },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: not enough security deposit',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when event status = DONE', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      const minSecDepo = 13661488;
      const heightDelta = 123;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      const startBlockHeight = await getBlockHeight(-10 - heightDelta, env.network);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 3 },
            { key: 'EVENT_START_BLOCK__0__0', type: 'integer', value: startBlockHeight },
            { key: 'RESET_BLOCK_DELTA', type: 'integer', value: heightDelta },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid event status',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when event status = INIT', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      const minSecDepo = 14881366;
      const heightDelta = 333;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      const startBlockHeight = await getBlockHeight(-100 - heightDelta, env.network);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 1 },
            { key: 'EVENT_START_BLOCK__0__0', type: 'integer', value: startBlockHeight },
            { key: 'RESET_BLOCK_DELTA', type: 'integer', value: heightDelta },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid event status',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    it('should throw when height more than start block + delta', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const rSigma = 'rsigma';
      const minSecDepo = 14881366;
      const heightDelta = 100;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      const startBlockHeight = await getBlockHeight(30 - heightDelta, env.network);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'R_SIGMA__0__0', type: 'string', value: rSigma },
            { key: 'CURRENT_EPOCH__0', type: 'integer', value: 0 },
            { key: 'SIGNERS_PER_EPOCH__0__0', type: 'string', value: user.publicKey },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: 'EVENT_STATUS__0__0', type: 'integer', value: 2 },
            { key: 'EVENT_START_BLOCK__0__0', type: 'integer', value: startBlockHeight },
            { key: 'RESET_BLOCK_DELTA', type: 'integer', value: heightDelta },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to reset',
        'Error while executing dApp: reset: invalid event status',
        async () => {
          await reset(0, 0, 'r', user);
        }
      );
      await step('check state', async () => {
        expect(await getDataValue(contract, 'R_SIGMA__0__0', env.network)).to.be.equal(rSigma);
      });
    });

    // MEMO: check race condition with last calling submitS() and reset()
    it('simple positive', async () => {
      const contract = getContractByName('signer', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const user2 = getAccountByName('morpheus', this.parent?.ctx);
      const user3 = getAccountByName('gerry', this.parent?.ctx);
      const rSigma = 'rsigma';
      const minSecDepo = 148813668;
      const heightDelta = 280;
      const epoch = 22;
      const eventId = 987654321;
      const eChainId = 100001;
      const r = 'new_r';
      const s = 'new_s';
      const punishment = 100000000;
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      const startBlockHeight = await getBlockHeight(-100 - heightDelta, env.network);
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: `CURRENT_EPOCH__${eChainId}`, type: 'integer', value: epoch },
            { key: `SIGNERS_PER_EPOCH__${eChainId}__${epoch}`, type: 'string',
              value: `${user3.publicKey}__${user.publicKey}__${user2.publicKey}` },
            { key: 'MIN_SEC_DEPO', type: 'integer', value: minSecDepo },
            { key: `EVENT_STATUS__${eChainId}__${eventId}`, type: 'integer', value: 2 },
            { key: `EVENT_START_BLOCK__${eChainId}__${eventId}`, type: 'integer', value: startBlockHeight },
            { key: 'RESET_BLOCK_DELTA', type: 'integer', value: heightDelta },
            { key: `T__${eChainId}__${epoch}`, type: 'integer', value: 3 },
            { key: 'PUNISHMENT', type: 'integer', value: punishment },
            // submit settings
            { key: `R__${eChainId}__${eventId}`, type: 'string', value: `${r}__${r}__${r}` },
            { key: `R__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user2.publicKey}`, type: 'string', value: r },
            { key: `R__${eChainId}__${eventId}__${user3.publicKey}`, type: 'string', value: r },
            { key: `R_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: `${user2.publicKey}__${user.publicKey}__${user3.publicKey}` },
            { key: `R_SIGMA__${eChainId}__${eventId}`, type: 'string', value: rSigma },
            { key: `S__${eChainId}__${eventId}`, type: 'string', value: `${s}__${s}` },
            { key: `S__${eChainId}__${eventId}__${user.publicKey}`, type: 'string', value: s },
            { key: `S__${eChainId}__${eventId}__${user3.publicKey}`, type: 'string', value: s },
            { key: `S__${eChainId}__${eventId}__${user2.publicKey}`, type: 'string', value: '' },
            { key: `S_SIGNERS__${eChainId}__${eventId}`, type: 'string', value: `${user.publicKey}__${user3.publicKey}` },
            { key: `S_SIGMA__${eChainId}__${eventId}`, type: 'string', value: '' },
            // sec depo settings
            { key: `SEC_DEPO__${user.address}`, type: 'integer', value: minSecDepo },
            { key: `SEC_DEPO__${user2.address}`, type: 'integer', value: 2 * minSecDepo },
            { key: `SEC_DEPO__${user3.address}`, type: 'integer', value: 3 * minSecDepo },
          ],
        });
      });
      const startUser1Balance = await getBalance(user.address, env.network);
      const startUser2Balance = await getBalance(user2.address, env.network);
      const startUser3Balance = await getBalance(user3.address, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMultisigBalance = await getBalance(techConract.dApp, env.network);
      await step('reset', async () => {
        await reset(eventId, eChainId, r, user);
      });
      await step('check state', async () => {
        // Check state for security balance;
        expect(await getDataValue(contract, `SEC_DEPO__${user.address}`, env.network)).to.be.equal(minSecDepo);
        expect(await getDataValue(contract, `SEC_DEPO__${user2.address}`, env.network)).to.be.equal(2 * minSecDepo - punishment);
        expect(await getDataValue(contract, `SEC_DEPO__${user3.address}`, env.network)).to.be.equal(3 * minSecDepo);
        // other state
        expect(await getDataValue(contract, `EVENT_STATUS__${eChainId}__${eventId}`, env.network)).to.be.equal(1);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user2.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R__${eChainId}__${eventId}__${user3.publicKey}`, env.network)).to.be.equal(r);
        expect(await getDataValue(contract, `R_SIGNERS__${eChainId}__${eventId}`, env.network)).to.be.equal(user.publicKey);
        expect(await getDataValue(contract, `R_SIGMA__${eChainId}__${eventId}`, env.network)).is.empty;
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}`, env.network)).is.empty;
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user.publicKey}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user2.publicKey}`, env.network)).is.empty;
        expect(await getDataValue(contract, `S__${eChainId}__${eventId}__${user3.publicKey}`, env.network)).to.be.equal(s);
        expect(await getDataValue(contract, `S_SIGNERS__${eChainId}__${eventId}`, env.network)).is.empty;
        expect(await getDataValue(contract, `S_SIGMA__${eChainId}__${eventId}`, env.network)).is.empty;
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - punishment);
        expect(await getBalance(user2.address, env.network)).to.be.equal(startUser2Balance);
        expect(await getBalance(user3.address, env.network)).to.be.equal(startUser3Balance + Math.floor(punishment / 2));
        expect(await getBalance(user.address, env.network))
          .to.be.equal(startUser1Balance + Math.floor(punishment / 2) - env.network.invokeFee);
        expect(await getBalance(techConract.dApp, env.network)).to.be.equal(startMultisigBalance);
      });
    });
  });
});

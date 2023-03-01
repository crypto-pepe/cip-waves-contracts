import {
  getAccountByName,
  getContractByName,
  getDataValue,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { expect } from 'chai';
import { getEnvironment } from 'relax-env-json';
import {
  init,
  pause,
  setMultisig,
  unpause,
  updatePauser,
  updateSigner,
} from '../../steps/executor';
import {
  base16Encode,
  base58Decode,
  base58Encode,
  signBytes,
  stringToBytes,
} from '@waves/ts-lib-crypto';
import { setSignedContext } from '../../steps/common';
const env = getEnvironment();

const OLD_PREFIX = '<<<PUBLIC--KEY--MIGRATION--ALLOWED>>>';
const NEW_PREFIX = '<<<PUBLIC--KEY--MIGRATION--CONFIRMED>>>';

/**
 * MEMO:    1) when we deploy contract we MUST call setMultisig AND init AND CHECK STATE!
 */
describe('Executor component', function () {
  /**
   * REQUIRED: clear state
   */
  xdescribe('before all special tests', async () => {
    it('[init] should throw when multisig not set', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to init contract',
        'Error while executing dApp: _whenMultisigSet: revert',
        async () => {
          await init(user.address, 0, signer.publicKey);
        }
      );
      await step('check PAUSER', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network, '')).is.empty;
      });
    });
  });

  describe('setMultisig tests', function () {
    // Need a clear state
    xit('should throw when it is not self-call', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
      const contract = getContractByName('executor', this.parent?.ctx);
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
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig address', async () => {
        await setMultisig(techConract.dApp);
      });
      expect(await getDataValue(contract, 'MULTISIG', env.network)).to.be.equal(
        techConract.dApp
      );
    });

    it('can change multisig addres the same', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
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
                  { type: 'string', value: signer.publicKey },
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
      const contract = getContractByName('executor', this.parent?.ctx);
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
          await init('jopa', 0, 'pussy');
        }
      );
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when invalid pauser\'s address', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
          await init('123abc', 0, 'fuck');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when chainID less than 0', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'Error while executing dApp: init: invalid chain id',
        async () => {
          await init(user.address, -1, 'ololo');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when chainID more than MAX_INT', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'Error while executing dApp: init: invalid chain id',
        async () => {
          await init(user.address, '9223372036854775808', 'tits');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when empty signer public key', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'Error while executing dApp: init: invalid signer public key',
        async () => {
          await init(user.address, 0, '');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when signer public key length less than 32', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'Error while executing dApp: init: invalid signer public key',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await init(user.address, 0, 'ArjsKHoDLSrT2T1gYqDitGdJxE3F5HyV8HMr448hG');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('should throw when signer public key length more than 32', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'Error while executing dApp: init: invalid signer public key',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await init(user.address, 0, 'FcdUzEFdSALVaFmwJg6TASE9yyrXUEkVtkNLQ5K7V32SN');
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'PAUSER', env.network)).is.empty;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
            { key: 'CHAIN_ID', type: 'integer', value: 777 },
            { key: 'SIGNER_PUBLIC_KEY', type: 'string', value: '' },
          ],
        });
      });
      await step('init contract', async () => {
        // eslint-disable-next-line prettier/prettier
        await init(user.address, 1366, signer.publicKey);
      });
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(user.address);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'CHAIN_ID', env.network, -1)).to.be.equal(1366);
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network)).to.be.equal(signer.publicKey);
      });
    });

    it('simple positive with chainID = max value', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'PAUSER', type: 'string', value: '' },
            { key: 'CHAIN_ID', type: 'integer', value: 777 },
            { key: 'SIGNER_PUBLIC_KEY', type: 'string', value: '' },
          ],
        });
      });
      await step('init contract', async () => {
        // eslint-disable-next-line prettier/prettier
        await init(user.address, '9223372036854775807', signer.publicKey);
      });
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.true;
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'PAUSER', env.network)).to.be.equal(user.address);
        // eslint-disable-next-line prettier/prettier
        expect(String(await getDataValue(contract, 'CHAIN_ID', env.network, -1))).to.be.equal('9223372036854775807');
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network)).to.be.equal(signer.publicKey);
      });
    });

    it('should throw when transaction is not confirmed', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set context', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to init contract',
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
                  { type: 'string', value: signer.publicKey },
                ],
              },
            },
            { privateKey: contract.privateKey },
            env.network
          );
        }
      );
      await step('check PAUSER', async () => {
        expect(await getDataValue(contract, 'INIT', env.network)).is.false;
      });
    });
  });

  describe('updatePauser tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'try to update pauser\'s address',
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
        expect(
          await getDataValue(contract, 'PAUSER', env.network)
        ).is.empty;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'try to update pauser\'s address',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          await updatePauser(user.address);
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'PAUSER', env.network)
        ).is.empty;
      });
    });

    // eslint-disable-next-line prettier/prettier
    it('should throw when invalid pauser\'s address', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        'try to update pauser\'s address',
        'Error while executing dApp: init: invalid pauser',
        async () => {
          await updatePauser('');
        }
      );
    });

    it('simple positive', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
      await step('update pauser\'s address', async () => {
        await updatePauser(user.address);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'PAUSER', env.network)
        ).to.be.equal(user.address);
      });
    });

    it('can set the same pauser', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
      await step('update pauser\'s address', async () => {
        await updatePauser(user.address);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'PAUSER', env.network)
        ).to.be.equal(user.address);
      });
      // eslint-disable-next-line prettier/prettier
      await step('update pauser\'s address again', async () => {
        await updatePauser(user.address);
      });
      await step('check state again', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(
          await getDataValue(contract, 'PAUSER', env.network)
        ).to.be.equal(user.address);
      });
    });
  });

  describe('pause tests', function () {
    it('should throw when call non-pauser', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.false;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.false;
      });
    });

    it('should throw when paused', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.true;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.true;
      });
    });
  });

  describe('unpause tests', function () {
    it('should throw when call non-pauser', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.true;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.true;
      });
    });

    it('should throw when not paused', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.false;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
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
        expect(
          await getDataValue(contract, 'PAUSED', env.network)
        ).is.false;
      });
    });
  });

  describe('updateSigner tests', function () {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'SIGNER_PUBLIC_KEY', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to update signer',
        'Error while executing dApp: _onlyThisContract: revert',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: {
                function: 'updateSigner',
                args: [
                  { type: 'string', value: 'newSignerPublicKey' },
                  { type: 'string', value: 'oldSignature' },
                  { type: 'string', value: 'newSignature' },
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
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network, '')).is.empty;
      });
    });

    it('should throw when not initialized', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: false },
            { key: 'SIGNER_PUBLIC_KEY', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to update signer',
        'Error while executing dApp: _whenInitialized: revert',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await updateSigner('newSignerPublicKey', 'oldSignature', 'newSignature');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network, '')).is.empty;
      });
    });

    it('should throw when wrong public key', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [
            { key: 'INIT', type: 'boolean', value: true },
            { key: 'SIGNER_PUBLIC_KEY', type: 'string', value: '' },
          ],
        });
      });
      await stepIgnoreErrorByMessage(
        'try to update signer',
        'Error while executing dApp: updateSigner: invalid signer public key',
        async () => {
          // eslint-disable-next-line prettier/prettier
          await updateSigner('', 'oldSignature', 'newSignature');
        }
      );
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network, '')).is.empty;
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      const newSigner = getAccountByName('morpheus', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await step('reinit (for set signer)', async () => {
        await init(pauser.address, 0, signer.publicKey);
      });
      await step('update signer', async () => {
        const oldSignature = signBytes(
          signer.privateKey,
          addByteArrays(
            stringToBytes(OLD_PREFIX),
            base58Decode(signer.publicKey),
            base58Decode(newSigner.publicKey)
          )
        );
        const newSignature = signBytes(
          newSigner.privateKey,
          addByteArrays(
            stringToBytes(NEW_PREFIX),
            base58Decode(signer.publicKey),
            base58Decode(newSigner.publicKey)
          )
        );
        // eslint-disable-next-line prettier/prettier
        await updateSigner(newSigner.publicKey, oldSignature, newSignature);
      });
      await step('check state', async () => {
        // eslint-disable-next-line prettier/prettier
        expect(await getDataValue(contract, 'SIGNER_PUBLIC_KEY', env.network)).to.be.equal(newSigner.publicKey);
      });
    });

    it('should throw when wrong old signer signature', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      const newSigner = getAccountByName('morpheus', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await step('reinit (for set signer)', async () => {
        await init(pauser.address, 0, signer.publicKey);
      });
      await stepIgnoreErrorByMessage(
        'update signer',
        'Error while executing dApp: updateSigner: invalid old signature',
        async () => {
          const oldSignature = signBytes(
            signer.privateKey,
            stringToBytes('wrong signature')
          );
          const newSignature = signBytes(
            newSigner.privateKey,
            addByteArrays(
              stringToBytes(NEW_PREFIX),
              base58Decode(signer.publicKey),
              base58Decode(newSigner.publicKey)
            )
          );
          // eslint-disable-next-line prettier/prettier
          await updateSigner(newSigner.publicKey, oldSignature, newSignature);
        }
      );
    });

    it('should throw when wrong new signer signature', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      const newSigner = getAccountByName('morpheus', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await step('reinit (for set signer)', async () => {
        await init(pauser.address, 0, signer.publicKey);
      });
      await stepIgnoreErrorByMessage(
        'update signer',
        'Error while executing dApp: updateSigner: invalid new signature',
        async () => {
          const oldSignature = signBytes(
            signer.privateKey,
            addByteArrays(
              stringToBytes(OLD_PREFIX),
              base58Decode(signer.publicKey),
              base58Decode(newSigner.publicKey)
            )
          );
          const newSignature = signBytes(
            newSigner.privateKey,
            stringToBytes('wrong signature')
          );
          // eslint-disable-next-line prettier/prettier
          await updateSigner(newSigner.publicKey, oldSignature, newSignature);
        }
      );
    });

    it('should throw when wrong both signers signature', async () => {
      const contract = getContractByName('executor', this.parent?.ctx);
      const techConract = getContractByName('technical', this.parent?.ctx);
      const pauser = getAccountByName('neo', this.parent?.ctx);
      const signer = getAccountByName('trinity', this.parent?.ctx);
      const newSigner = getAccountByName('morpheus', this.parent?.ctx);
      await step('set multisig', async () => {
        await setMultisig(techConract.dApp);
      });
      await step('set state', async () => {
        await setSignedContext(contract, {
          data: [{ key: 'INIT', type: 'boolean', value: false }],
        });
      });
      await step('reinit (for set signer)', async () => {
        await init(pauser.address, 0, signer.publicKey);
      });
      await stepIgnoreErrorByMessage(
        'update signer',
        'Error while executing dApp: updateSigner: invalid old signature',
        async () => {
          const oldSignature = signBytes(
            signer.privateKey,
            stringToBytes('wrong old signature')
          );
          const newSignature = signBytes(
            newSigner.privateKey,
            stringToBytes('wrong new signature')
          );
          // eslint-disable-next-line prettier/prettier
          await updateSigner(newSigner.publicKey, oldSignature, newSignature);
        }
      );
    });
  });

  xdescribe('execute tests', function () {
    // it('should throw when not initialized', async () => {
    //   const contract = getContractByName('executor', this.parent?.ctx);
    //   const techConract = getContractByName('technical', this.parent?.ctx);
    //   await step('set multisig', async () => {
    //     await setMultisig(techConract.dApp);
    //   });
    //   await step('set state', async () => {
    //     await setSignedContext(contract, {
    //       data: [{ key: 'INIT', type: 'boolean', value: false }],
    //     });
    //   });
    //   await stepIgnoreErrorByMessage(
    //     'try to execute',
    //     'Error while executing dApp: _whenInitialized: revert',
    //     async () => {
    //       // eslint-disable-next-line prettier/prettier
    //       await execute();
    //     }
    //   );
    // });

    it('should throw when paused', async () => {});

    it('should throw when wrong contract address', async () => {});

    it('should throw when execution chainID end chain ID equals', async () => {});

    it('should throw when wrong signature', async () => {});

    it('should throw when duplicate data', async () => {});

    it('simple positive', async () => {});

    // TODO: check enough hash keccak256_32 (hash length)
  });
});

function addByteArrays(
  array1: Uint8Array,
  array2: Uint8Array,
  array3: Uint8Array
): Uint8Array {
  const result = new Uint8Array(array1.length + array2.length + array3.length);
  result.set(array1, 0);
  result.set(array2, array1.length);
  result.set(array3, array1.length + array2.length);
  return result;
}

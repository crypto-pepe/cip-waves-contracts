import {
  getAccountByName,
  getContractByName,
  getDataValue,
  invoke
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
import {
  step,
  stepCatchError,
  stepIgnoreErrorByMessage
} from 'relax-steps-allure';
import { getEnvironment } from 'relax-env-json';
import {
  addOwner,
  confirmTransaction,
  removeOwner,
  revokeConfirmation,
  setQuorum
} from '../../steps/multisig';
import {
  getTechUser,
  prepareDataTx,
  prepareInvokeTx,
  sendTransaction,
  setSignedContext,
  setTxMultisig
} from '../../steps/common';
import { expect } from 'chai';
const env = getEnvironment();

describe('Multisig', function() {
  // describe('init tests', function() {});

  describe('addOwner tests', async () => {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('multisig', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        'Error while executing dApp: addOwner: not allowed',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'addOwner',
                args: [{ type: 'string', value: user.publicKey }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when try add empty public key', async () => {
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        'Error while executing dApp: invalid owner',
        async () => {
          await addOwner('');
        }
      );
    });

    it('should throw when try add wrong public key', async () => {
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        'Error while executing dApp: invalid owner public key',
        async () => {
          await addOwner(base58Encode('abc'));
        }
      );
    });

    /**
     * MEMO: refactor multisig code - this check never been with message "addOwner: invalid public key"
     */
    it('should throw when validation failed', async () => {
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        // What the case with?
        // 'Error while executing dApp: addOwner: invalid public key',
        'Error while executing dApp: invalid owner public key',
        async () => {
          await addOwner(base58Encode('abcabcabcabcabcabcabcabcabcabcab'));
        }
      );
    });

    it('simple positive', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: getTechUser().publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await step('add new owner', async () => {
        await addOwner(user.publicKey);
      });
      await step('check state', async () => {
        const keys = String(await getDataValue(multisig, 'PUBLIC_KEYS', env.network)).split('__');
        expect(keys).contains(user.publicKey);
      });
    });

    it('should throw when too many owners', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        let keys = '';
        for(let i = 0; i < 10; i++) {
          if(keys.length > 0) {
            keys = keys + '__';
          }
          keys = keys + techUser.publicKey;
        }
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: keys },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        'Error while executing dApp: addOwner: too many owners',
        async () => {
          await addOwner(user.publicKey);
        }
      );
      await step('revert state', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
    });

    it('can\'t add duplicate', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: getTechUser().publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke addOwner',
        'Error while executing dApp: addOwner: public key already added',
        async () => {
          await addOwner(techUser.publicKey);
        }
      );
      await step('check state', async () => {
        const keys = String(await getDataValue(multisig, 'PUBLIC_KEYS', env.network)).split('__');
        expect(keys).has.length(1);
      });
    });
  });

  describe('removeOwner tests', function() {
    it('should throw when not self-call', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke removeOwner',
        'Error while executing dApp: removeOwner: not allowed',
        async () => {
          await invoke(
            {
              dApp: multisig.dApp,
              call: { 
                function: 'removeOwner',
                args: [{ type: 'string', value: techUser.publicKey }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when empty key', async () => {
      await stepIgnoreErrorByMessage(
        'try to invoke removeOwner',
        'Error while executing dApp: removeOwner: invalid public key',
        async () => {
          await removeOwner('');
        }
      );
    });

    it('should throw when just 1 owner', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: getTechUser().publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke removeOwner',
        'Error while executing dApp: removeOwner: too few owners',
        async () => {
          await removeOwner(techUser.publicKey);
        }
      );
    });

    it('should throw when key not in list', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: getTechUser().publicKey + '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke removeOwner',
        'Error while executing dApp: removeOwner: no such owner',
        async () => {
          await removeOwner(user.publicKey);
        }
      );
    });

    it('simple positive', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey +  '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await step('remove owner', async () => {
        await removeOwner(user.publicKey);
      });
      await step('check state', async () => {
        const keys = String(await getDataValue(multisig, 'PUBLIC_KEYS', env.network)).split('__');
        expect(keys).has.length(2);
        expect(keys).is.not.contains(user.publicKey);
      });
    });

    it('quorum decrised when list size less than quorum', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: user.publicKey + '__' + techUser.publicKey },
              { key: 'QUORUM', type: 'integer', value: 2 }
            ]
          }
        );
      });
      await step('remove owner', async () => {
        const tx = prepareInvokeTx(
          {
            dApp: multisig.dApp,
            call: {
              function: 'removeOwner',
              args: [{ type: 'string', value: user.publicKey }]
            },
          },
          { privateKey: multisig.privateKey }
        );
        await setTxMultisig(
          multisig.dApp,
          tx.id,
          [techUser, user]
        );
        await sendTransaction(tx);
      });
      await step('check state', async () => {
        const keys = String(await getDataValue(multisig, 'PUBLIC_KEYS', env.network)).split('__');
        expect(keys).has.length(1);
        expect(
          await getDataValue(multisig, 'QUORUM', env.network)
        ).to.be.equal(1);
      });
    });
  });

  describe('setQuorum tests', function() {
    it('should throw when not self-call', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setQuorum',
        'Error while executing dApp: setQuorum: not allowed',
        async () => {
          await invoke(
            {
              dApp: multisig.dApp,
              call: { 
                function: 'setQuorum',
                args: [{ type: 'integer', value: 1 }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when less than 1', async () => {
      await stepIgnoreErrorByMessage(
        'try to invoke setQuorum',
        'Error while executing dApp: setQuorum: invalid quorum',
        async () => {
          await setQuorum(0);
        }
      );
    });

    it('should throw when more than owners', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey +  '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke setQuorum',
        'Error while executing dApp: setQuorum: invalid quorum',
        async () => {
          await setQuorum(4);
        }
      );
    });

    it('simple positive', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey +  '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await step('set quorum', async () => {
        await setQuorum(3);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(multisig, 'QUORUM', env.network)
        ).to.be.equal(3);
      });
      await step('reset state', async () => {
        const tx = await prepareDataTx(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
        await setTxMultisig(
          multisig.dApp,
          tx.id,
          [user, other, techUser]
        );
        await sendTransaction(tx);
      });
    });
  });

  describe('confirmTransaction tests', function() {
    it('shoul throw wneh called by no-owner', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      await stepIgnoreErrorByMessage(
        'try to confirm transaction',
        'Error while executing dApp: confirmTransaction: only admin',
        async () => {
          await confirmTransaction(
            other,
            multisig.dApp,
            randTx.id
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.false;
      });
    });

    it('shoul throw wneh wrong txId', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = { id: base58Encode('abc123') };
      await stepIgnoreErrorByMessage(
        'try to confirm transaction',
        'Error while executing dApp: confirmTransaction: invalid txId',
        async () => {
          await confirmTransaction(
            user,
            multisig.dApp,
            randTx.id
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.false;
      });
    });

    it('shoul throw wneh wrong dApp address', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      const dApp = base58Encode('123abc');
      await stepIgnoreErrorByMessage(
        'try to confirm transaction',
        'Error while executing dApp: confirmTransaction: invalid dapp address',
        async () => {
          await confirmTransaction(
            user,
            dApp,
            randTx.id
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${dApp}__${randTx.id}`, env.network, false)
        ).is.false;
      });
    });

    it('shoul throw wneh re-confirm', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      await step('confirm transaction first time', async () => {
        await confirmTransaction(
          user,
          multisig.dApp,
          randTx.id
        );
      });
      await stepIgnoreErrorByMessage(
        'try to confirm transaction',
        'Error while executing dApp: confirmTransaction: already confirmed',
        async () => {
          await confirmTransaction(
            user,
            multisig.dApp,
            randTx.id
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.true;
      });
    });

    it('check state changes', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey + '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 2 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      await step('first confirmation', async () => {
        await confirmTransaction(user, multisig.dApp, randTx.id);
      });
      await step('check state after first confirmation', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.false;
      });
      await step('second confirmation', async () => {
        await confirmTransaction(techUser, multisig.dApp, randTx.id);
      });
      await step('check state after second confirmation', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.true;
      });
      await step('third confirmation', async () => {
        await confirmTransaction(other, multisig.dApp, randTx.id);
      });
      await step('check state after third confirmation', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network, false)
        ).is.true;
      });
      await step('reset state', async () => {
        const tx = await prepareDataTx(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
        await setTxMultisig(
          multisig.dApp,
          tx.id,
          [user, other, techUser]
        );
        await sendTransaction(tx);
      });
    });
  });

  describe('revokeConfirmation tests', function() {
    it('should throw when called by no-owner', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      await stepIgnoreErrorByMessage(
        'try to revoke transaction',
        'Error while executing dApp: revokeConfirmation: only admin',
        async () => {
          await revokeConfirmation(
            other,
            multisig.dApp,
            randTx.id
          );
        }
      );
    });

    it('should throw when invalid txId', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = { id: base58Encode('abc123') };
      await stepIgnoreErrorByMessage(
        'try to revoke transaction',
        'Error while executing dApp: revokeConfirmation: invalid txId',
        async () => {
          await revokeConfirmation(
            user,
            multisig.dApp,
            randTx.id
          );
        }
      );
    });

    it('should throw when invalid dApp address', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      const dApp = base58Encode('123abc');
      await stepIgnoreErrorByMessage(
        'try to revoke transaction',
        'Error while executing dApp: revokeConfirmation: invalid dapp address',
        async () => {
          await revokeConfirmation(
            user,
            dApp,
            randTx.id
          );
        }
      );
    });

    it('should throw when been not confirmed', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const randTx = await prepareDataTx(multisig, { data: []});
      await stepIgnoreErrorByMessage(
        'try to revoke transaction',
        'Error while executing dApp: revokeConfirmation: not confirmed',
        async () => {
          await revokeConfirmation(
            user,
            multisig.dApp,
            randTx.id
          );
        }
      );
    });

    it('should throw when quorum reached', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const randTx = await prepareDataTx(multisig, { data: []});
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 },
              { key: `STATUS__${multisig.dApp}__${randTx.id}`, type: 'boolean', value: true },
              { key: `CONFIRM__${multisig.dApp}__${randTx.id}`, type: 'string', value: user.publicKey }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to revoke transaction',
        'Error while executing dApp: revokeConfirmation: quorum already reached',
        async () => {
          await revokeConfirmation(
            user,
            multisig.dApp,
            randTx.id
          );
        }
      );
    });

    it('check state', async () => {
      const multisig = getContractByName('multisig', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const other = getAccountByName('trinity', this.parent?.ctx);
      const randTx = await prepareDataTx(multisig, { data: []});
      await step('reset owners', async () => {
        await setSignedContext(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey + '__' + user.publicKey + '__' + other.publicKey },
              { key: 'QUORUM', type: 'integer', value: 3 },
              { key: `STATUS__${multisig.dApp}__${randTx.id}`, type: 'boolean', value: false },
              { key: `CONFIRM__${multisig.dApp}__${randTx.id}`, type: 'string', value: user.publicKey + '__' + other.publicKey }
            ]
          }
        );
      });
      await step('first revoke', async () => {
        await revokeConfirmation(
          user,
          multisig.dApp,
          randTx.id
        );
      });
      await step('check state after first revoke', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network)
        ).is.false;
        expect(
          await getDataValue(multisig, `CONFIRM__${multisig.dApp}__${randTx.id}`, env.network)
        ).to.be.equal(other.publicKey);
      });
      await step('second revoke', async () => {
        await revokeConfirmation(
          other,
          multisig.dApp,
          randTx.id
        );
      });
      await step('check state after second revoke', async () => {
        expect(
          await getDataValue(multisig, `STATUS__${multisig.dApp}__${randTx.id}`, env.network)
        ).is.false;
        expect(
          await getDataValue(multisig, `CONFIRM__${multisig.dApp}__${randTx.id}`, env.network)
        ).to.be.equal('');
      });
      await step('revert state', async () => {
        const tx = await prepareDataTx(
          multisig,
          {
            data: [
              { key: 'PUBLIC_KEYS', type: 'string', value: techUser.publicKey },
              { key: 'QUORUM', type: 'integer', value: 1 }
            ]
          }
        );
        await setTxMultisig(
          multisig.dApp,
          tx.id,
          [user, techUser, other]
        );
        await sendTransaction(tx);
      });
    });
  });
});
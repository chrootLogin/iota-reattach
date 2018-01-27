/*
 * Copyright (c) 2018. by Simon Erhardt <me@rootlogin.ch>
 *
 * This file is part of Iota-Reattach.
 *
 * Iota-Reattach is free software: you can redistribute
 * it and/or modify it under the terms of the GNU General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * Iota-Reattach is distributed in the hope that it will
 * be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 * of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Iota-Reattach. If not, see <http://www.gnu.org/licenses/>.
 *
 * @license GPL-3.0+ <http://spdx.org/licenses/GPL-3.0+>
 *
 */

let IOTA = require('iota.lib.js'),
    CCurl = require('ccurl.interface.js'),
    program = require('commander'),
    transactionId;

program
    .version('0.1.0')
    .option('-s, --sleep', 'Sleep-time in seconds (default: 60)', parseInt)
    .option('-h, --host', 'Host (default: http://iota.rootlogin.ch)')
    .option('-p, --port', 'Port (default: 14265)', parseInt)
    .arguments('<transactionHash>')
    .action((transactionHash) => {
        transactionId = transactionHash;
    })
    .parse(process.argv);

let SLEEP = 60,
    HOST = "http://iota.rootlogin.ch",
    PORT = 14265;

if(program.sleep !== undefined) {
    SLEEP = program.sleep;
}
if(program.host !== undefined) {
    HOST = program.host;
}
if(program.port !== undefined) {
    HOST = program.port;
}
if(transactionId === undefined) {
    console.error('No transaction id given!');
    process.exit(1);
}

// Create IOTA instance with host and port as provider
let iota = new IOTA({
    'host': HOST,
    'port': PORT
});

// Overwrite attachToTangle with local POW function
iota.api.attachToTangle = function(trunk, branch, mwn, trytes, callback) {
    return CCurl(trunk, branch, mwn, trytes, ".", callback);
};

let _try = 0;
function isConfirmed(transaction) {
    iota.api.getLatestInclusion([transaction], async (error, states) => {
        if (error) {
            console.log(error);

            setTimeout(() => {
                isConfirmed(transaction);
            }, SLEEP * 1000);
            return
        }

        if(states[0]) {
            console.log('Withdrawal transaction with tail hash:', transaction, 'confirmed');
        } else {
            console.log('Withdrawal transaction with tail hash:', transaction, 'not confirmed');

            let promotable = await iota.api.isPromotable(transaction);
            if(_try % 10 === 0 || !promotable) {
                reattachTransaction(transaction);
            } else {
                promoteTransaction(transaction);
            }
        }
    });

    _try++;
}

function promoteTransaction(transaction) {
    let t = [{
        address: "ROOTLOGIN9DOT9CH99999999999999999999999999999999999999999999999999999999999999999",
        value: 0,
        message: "ROOTLOGIN9DOT9CH",
        tag: "ROOTLOGIN9DOT9CH"
    }];

    console.log("Trying to promote transaction:", transaction);
    iota.api.promoteTransaction(transaction, 3, 14, t, {interrupt: false, delay: 0}, (error, success) => {
        if(error) {
            console.error(error.message);
        } else {
            console.log("Promoted with transaction:", success[0].hash);
            console.log("Transaction", transaction, "successfully promoted!");
        }

        console.log("Sleeping", SLEEP, "seconds...");
        setTimeout(() => {
            isConfirmed(transaction);
        }, SLEEP * 1000);
    });
}

function reattachTransaction(transaction) {
    console.log("Trying to re-attach transaction:", transaction);
    iota.api.replayBundle(transaction, 3, 14, (error, success) => {
        if(error){
            console.error(error.message);
        } else {
            let newTransaction = success[0].hash;

            console.log("Using re-attached transaction:", newTransaction);
            console.log("Sleeping", SLEEP, "seconds...");
            setTimeout(() => {
                isConfirmed(newTransaction);
            }, SLEEP * 1000);
        }
    });
}

isConfirmed(transactionId);
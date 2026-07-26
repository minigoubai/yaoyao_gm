/**
 * Hardhat 配置
 */
require('./tasks/run_tests');
require('dotenv').config();

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000
      }
    }
  },
  networks: {
    hardhat: {
      accounts: { mnemonic: 'test test test test test test test test test test test junk' }
    },
    'giwa-sepolia': {
      url: 'https://sepolia-rpc.giwa.io',
      accounts: [process.env.DEPLOYER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000']
    }
  }
};

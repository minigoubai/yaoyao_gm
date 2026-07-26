// =============================================
// 合约配置 - 部署后自动生成
// =============================================
// 请在部署合约后运行: node deploy.js
// 脚本会自动更新此文件

const CONFIG = {
  // 合约地址（部署后填入）
  CONTRACT_ADDRESS: '',

  // GIWA Sepolia 配置
  GIWA_SEPOLIA: {
    chainId: '0x16536',       // 91342
    chainIdHex: '0x16536',
    chainName: 'GIWA Sepolia',
    rpcUrls: ['https://sepolia-rpc.giwa.io'],
    blockExplorerUrls: ['https://sepolia-explorer.giwa.io'],
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },

  // 合约默认票价（ETH）
  DEFAULT_TICKET_PRICE: '0.001',

  // 合约 ABI
  CONTRACT_ABI: []
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

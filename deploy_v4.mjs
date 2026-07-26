import ethers from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const RPC = 'https://sepolia-rpc.giwa.io';
const PK = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);
    console.log('Wallet:', wallet.address);

    const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json', 'utf8'));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    const gasPrice = await provider.getGasPrice();
    console.log('Gas price:', gasPrice.toString());

    const contract = await factory.deploy({ gasPrice, gasLimit: 3000000 });
    await contract.deployed();
    console.log('Deployed to:', contract.address);

    // configure: 0.001 ETH, max 50 players, 1 hour duration
    const cfg = await contract.configure(
        ethers.utils.parseEther('0.001'),
        50,
        3600,
        { gasLimit: 500000 }
    );
    await cfg.wait();
    console.log('Configured');

    const cfg2 = await contract.getConfig();
    console.log('Config:', cfg2);

    fs.writeFileSync('deployed.json', JSON.stringify({
        network: 'giwa-sepolia',
        contractAddress: contract.address,
        timestamp: new Date().toISOString()
    }, null, 2));
    console.log('Saved to deployed.json');
}

main().catch(e => { console.error(e); process.exit(1); });

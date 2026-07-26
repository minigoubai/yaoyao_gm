const { expect } = require('chai');
const hre = require('hardhat');

describe('GiwaLotteryV2', function () {
  let contract, deployer, player1, player2, player3, ticketPrice;

  beforeEach(async function () {
    const signers = await hre.network.provider.getSigners();
    deployer = signers[0];
    player1 = signers[1];
    player2 = signers[2];
    player3 = signers[3];
    const Factory = await hre.ethers.getContractFactory('GiwaLotteryV2', deployer);
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    ticketPrice = await contract.ticketPrice();
  });

  it('部署正常，初始状态正确', async function () {
    expect(await contract.MANAGER()).to.eq(deployer.address);
    expect(await contract.currentPhase()).to.eq(0);
    expect(await contract.round()).to.eq(1);
    expect(await contract.getTotalTickets()).to.eq(0);
  });

  it('一人多张票', async function () {
    await contract.connect(player1).buyTickets(1, { value: ticketPrice });
    await contract.connect(player2).buyTickets(3, { value: ticketPrice.mul(3) });
    expect(await contract.getTotalTickets()).to.eq(4);
    expect(await contract.getTicketCount(player2.address)).to.eq(3);
    expect(await contract.getPrizePool()).to.eq(ticketPrice.mul(4));
  });

  it('阈值触发自动进入Commit', async function () {
    await contract.configure(ethers.parseEther('0.001'), 2, 0, 1000);
    await contract.connect(player1).buyTickets(1, { value: ticketPrice });
    expect(await contract.currentPhase()).to.eq(0);
    await contract.connect(player2).buyTickets(1, { value: ticketPrice });
    expect(await contract.currentPhase()).to.eq(1);
  });

  it('完整流程 Commit→Reveal→Draw，奖金分配正确', async function () {
    await contract.configure(ethers.parseEther('0.001'), 3, 0, 1000);
    await contract.connect(player1).buyTickets(1, { value: ticketPrice });
    await contract.connect(player2).buyTickets(2, { value: ticketPrice.mul(2) });
    await contract.connect(player3).buyTickets(1, { value: ticketPrice });

    const commitBatch = async (player, secret) => {
      const indices = await contract.connect(player).getMyTicketIndices(player.address);
      const hashes = indices.map(idx =>
        ethers.keccak256(ethers.utils.defaultAbiCoder.encode(
          ['uint256','address','uint256'], [secret, player.address, idx]
        ))
      );
      await contract.connect(player).commitTicketsBatch(indices, hashes);
    };
    await commitBatch(player1, 111);
    await commitBatch(player2, 222);
    await commitBatch(player3, 333);
    expect(await contract.currentPhase()).to.eq(2);

    const revealBatch = async (player, secret) => {
      const indices = await contract.connect(player).getMyTicketIndices(player.address);
      await contract.connect(player).revealTicketsBatch(indices, indices.map(()=>secret));
    };
    await revealBatch(player1, 111);
    await revealBatch(player2, 222);
    await revealBatch(player3, 333);

    const poolBefore = await hre.ethers.provider.getBalance(contract.getAddress());
    const tx = await contract.draw();
    const receipt = await tx.wait();

    let winnersEvent;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'WinnersPicked') winnersEvent = parsed;
      } catch(e) {}
    }
    expect(winnersEvent).to.not.be.undefined;

    const [w1, p1, w2, p2, w3, p3] = winnersEvent.args;
    expect(w1).to.be.properAddress;
    expect(w2).to.be.properAddress;
    expect(w3).to.be.properAddress;

    const total = p1.add(p2).add(p3);
    expect(p1).to.eq(total.mul(5000).div(10000));
    expect(p2).to.eq(total.mul(2500).div(10000));
    expect(p3).to.eq(total.mul(1500).div(10000));

    expect(await contract.round()).to.eq(2);
    expect(await contract.currentPhase()).to.eq(0);
  });
});

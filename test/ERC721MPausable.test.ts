import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

describe('ERC721MPausable', function () {
  let erc721MPausable: Contract;
  let owner: any;
  let receiver: any;

  beforeEach(async function () {
    const ERC721MPausableFactory = await ethers.getContractFactory(
      'ERC721MPausable',
    );
    [owner, receiver] = await ethers.getSigners();

    erc721MPausable = await ERC721MPausableFactory.deploy(
      'test',
      'TEST',
      '.json',
      1000,
      0,
      ethers.constants.AddressZero,
      300,
      ethers.constants.AddressZero,
    );
    erc721MPausable = erc721MPausable.connect(owner);
    await erc721MPausable.deployed();

    const block = await ethers.provider.getBlock(
      await ethers.provider.getBlockNumber(),
    );
    // +10 is a number bigger than the count of transactions up to mint
    const stageStart = block.timestamp + 10;
    // Set stages
    await erc721MPausable.setStages([
      {
        price: ethers.utils.parseEther('0.5'),
        walletLimit: 0,
        merkleRoot: ethers.utils.hexZeroPad('0x0', 32),
        maxStageSupply: 5,
        startTimeUnixSeconds: stageStart,
        endTimeUnixSeconds: stageStart + 10000,
      },
    ]);
    await erc721MPausable.setMintable(true);
    // Setup the test context: Update block.timestamp to comply to the stage being active
    await ethers.provider.send('evm_mine', [stageStart - 1]);
  });

  it('should revert if non-owner tries to pause/unpause', async function () {
    await expect(erc721MPausable.connect(receiver).pause()).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
    await expect(
      erc721MPausable.connect(receiver).unpause(),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  describe('Test transfers when paused/unpaused', function () {
    beforeEach(async function () {
      const qty = 2;
      const proof = [ethers.utils.hexZeroPad('0x', 32)]; // Placeholder
      const timestamp = 0;
      const signature = '0x00'; // Placeholder

      await erc721MPausable.mint(qty, proof, timestamp, signature, {
        value: ethers.utils.parseEther('50'),
      });
    });

    it('should revert transfers when paused', async function () {
      await erc721MPausable.pause();
      await expect(
        erc721MPausable.transferFrom(owner.address, receiver.address, 0),
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should allow transfers when not paused and approved', async function () {
      await erc721MPausable.transferFrom(owner.address, receiver.address, 0);
      expect(await erc721MPausable.ownerOf(0)).to.equal(receiver.address);
    });

    it('should revert safe transfers when paused', async function () {
      await erc721MPausable.pause();

      await expect(
        erc721MPausable['safeTransferFrom(address,address,uint256)'](
          owner.address,
          receiver.address,
          0,
        ),
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        erc721MPausable['safeTransferFrom(address,address,uint256,bytes)'](
          owner.address,
          receiver.address,
          0,
          [],
        ),
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should allow safe transfers when not paused and approved', async function () {
      await erc721MPausable['safeTransferFrom(address,address,uint256)'](
        owner.address,
        receiver.address,
        0,
      );
      expect(await erc721MPausable.ownerOf(0)).to.equal(receiver.address);

      await erc721MPausable['safeTransferFrom(address,address,uint256,bytes)'](
        owner.address,
        receiver.address,
        1,
        [],
      );
      expect(await erc721MPausable.ownerOf(1)).to.equal(receiver.address);
    });
  });

  describe('Test other actions when paused/unpaused', function () {
    it('should allow minting when paused', async function () {
      const qty = 1;
      const proof = [ethers.utils.hexZeroPad('0x', 32)]; // Placeholder
      const timestamp = 0;
      const signature = '0x00'; // Placeholder
      await erc721MPausable.pause();
      await erc721MPausable.mint(qty, proof, timestamp, signature, {
        value: ethers.utils.parseEther('50'),
      });

      expect(await erc721MPausable.ownerOf(0)).to.equal(owner.address);
    });

    it('should allow minting when unpaused', async function () {
      const qty = 1;
      const proof = [ethers.utils.hexZeroPad('0x', 32)]; // Placeholder
      const timestamp = 0;
      const signature = '0x00'; // Placeholder
      await erc721MPausable.pause();
      await erc721MPausable.unpause();
      await erc721MPausable.mint(qty, proof, timestamp, signature, {
        value: ethers.utils.parseEther('50'),
      });

      expect(await erc721MPausable.ownerOf(0)).to.equal(owner.address);
    });
  });
});

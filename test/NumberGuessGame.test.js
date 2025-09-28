const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NumberGuessGame", function () {
  let gameContract;
  let owner;
  let player1;
  let player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();
    
    const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");
    gameContract = await NumberGuessGame.deploy();
    await gameContract.waitForDeployment();

    // 为奖池添加初始资金
    await gameContract.addToPool({ value: ethers.parseEther("10.0") });
  });

  describe("部署", function () {
    it("应该正确设置初始配置", async function () {
      const config = await gameContract.config();
      expect(config.minBet).to.equal(ethers.parseEther("0.0001"));
      expect(config.maxBet).to.equal(ethers.parseEther("1.0"));
      expect(config.platformFeePercent).to.equal(2);
      expect(config.houseEdgePercent).to.equal(5);
    });

    it("应该设置正确的所有者", async function () {
      expect(await gameContract.owner()).to.equal(owner.address);
    });
  });

  describe("猜大小游戏", function () {
    it("应该允许玩家下注猜大", async function () {
      const betAmount = ethers.parseEther("0.1");
      const tx = await gameContract.connect(player1).createGuessSizeGame(true, { value: betAmount });
      await expect(tx).to.emit(gameContract, "GameCreated");
    });

    it("应该允许玩家下注猜小", async function () {
      const betAmount = ethers.parseEther("0.1");
      const tx = await gameContract.connect(player1).createGuessSizeGame(false, { value: betAmount });
      await expect(tx).to.emit(gameContract, "GameCreated");
    });

    it("应该拒绝超出范围的下注", async function () {
      const tooSmallBet = ethers.parseEther("0.00001"); // 小于最小下注
      const tooBigBet = ethers.parseEther("2.0"); // 大于最大下注

      await expect(
        gameContract.connect(player1).createGuessSizeGame(true, { value: tooSmallBet })
      ).to.be.revertedWith("Bet amount out of range");

      await expect(
        gameContract.connect(player1).createGuessSizeGame(true, { value: tooBigBet })
      ).to.be.revertedWith("Bet amount out of range");
    });

    it("应该正确处理游戏结果", async function () {
      const betAmount = ethers.parseEther("0.1");
      const tx = await gameContract.connect(player1).createGuessSizeGame(true, { value: betAmount });
      const receipt = await tx.wait();
      
      // 获取游戏ID
      const gameCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = gameContract.interface.parseLog(log);
          return parsed.name === 'GameCreated';
        } catch (e) {
          return false;
        }
      });
      
      if (gameCreatedEvent) {
        const parsed = gameContract.interface.parseLog(gameCreatedEvent);
        const gameId = parsed.args.gameId;
        
        // 获取游戏详情
        const game = await gameContract.getGame(gameId);
        expect(game.player).to.equal(player1.address);
        expect(game.betAmount).to.equal(betAmount);
        expect(game.gameType).to.equal(0); // GuessSize
        expect(Number(game.status)).to.be.oneOf([1, 2]); // Won or Lost
      }
    });
  });

  describe("猜数字游戏", function () {
    it("应该允许玩家下注猜数字", async function () {
      const betAmount = ethers.parseEther("0.1");
      const tx = await gameContract.connect(player1).createGuessNumberGame(3, { value: betAmount });
      await expect(tx).to.emit(gameContract, "GameCreated");
    });

    it("应该拒绝无效的猜测数字", async function () {
      const betAmount = ethers.parseEther("0.1");

      await expect(
        gameContract.connect(player1).createGuessNumberGame(0, { value: betAmount })
      ).to.be.revertedWith("Guess must be between 1 and 6");

      await expect(
        gameContract.connect(player1).createGuessNumberGame(7, { value: betAmount })
      ).to.be.revertedWith("Guess must be between 1 and 6");
    });

    it("应该正确处理游戏结果", async function () {
      const betAmount = ethers.parseEther("0.1");
      const guess = 3;
      const tx = await gameContract.connect(player1).createGuessNumberGame(guess, { value: betAmount });
      const receipt = await tx.wait();
      
      // 获取游戏ID
      const gameCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = gameContract.interface.parseLog(log);
          return parsed.name === 'GameCreated';
        } catch (e) {
          return false;
        }
      });
      
      if (gameCreatedEvent) {
        const parsed = gameContract.interface.parseLog(gameCreatedEvent);
        const gameId = parsed.args.gameId;
        
        // 获取游戏详情
        const game = await gameContract.getGame(gameId);
        expect(game.player).to.equal(player1.address);
        expect(game.betAmount).to.equal(betAmount);
        expect(game.gameType).to.equal(1); // GuessNumber
        expect(game.guess).to.equal(guess);
        expect(Number(game.status)).to.be.oneOf([1, 2]); // Won or Lost
      }
    });
  });

  describe("管理员功能", function () {
    it("应该允许所有者更新配置", async function () {
      const newMinBet = ethers.parseEther("0.01");
      const newMaxBet = ethers.parseEther("2.0");
      const newPlatformFee = 3;
      const newHouseEdge = 7;

      await gameContract.updateConfig(newMinBet, newMaxBet, newPlatformFee, newHouseEdge);
      
      const config = await gameContract.config();
      expect(config.minBet).to.equal(newMinBet);
      expect(config.maxBet).to.equal(newMaxBet);
      expect(config.platformFeePercent).to.equal(newPlatformFee);
      expect(config.houseEdgePercent).to.equal(newHouseEdge);
    });

    it("应该允许所有者暂停和恢复游戏", async function () {
      await gameContract.pause();
      expect(await gameContract.paused()).to.be.true;

      await gameContract.unpause();
      expect(await gameContract.paused()).to.be.false;
    });

    it("应该允许所有者提取平台收入", async function () {
      // 先进行一些游戏以产生平台收入
      const betAmount = ethers.parseEther("0.1");
      await gameContract.connect(player1).createGuessSizeGame(true, { value: betAmount });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      const platformRevenue = await gameContract.getPlatformRevenue();
      
      if (platformRevenue > 0) {
        await gameContract.withdrawPlatformRevenue();
        const finalBalance = await ethers.provider.getBalance(owner.address);
        expect(finalBalance).to.be.gt(initialBalance);
      }
    });
  });

  describe("奖池管理", function () {
    it("应该正确跟踪奖池余额", async function () {
      const initialPool = await gameContract.getPoolBalance();
      expect(initialPool).to.equal(ethers.parseEther("10.0"));

      // 添加更多资金到奖池
      const additionalAmount = ethers.parseEther("5.0");
      await gameContract.addToPool({ value: additionalAmount });
      
      const newPool = await gameContract.getPoolBalance();
      expect(newPool).to.equal(ethers.parseEther("15.0"));
    });
  });

  describe("游戏记录", function () {
    it("应该正确记录玩家游戏", async function () {
      const betAmount = ethers.parseEther("0.1");
      await gameContract.connect(player1).createGuessSizeGame(true, { value: betAmount });

      const playerGames = await gameContract.getPlayerGames(player1.address);
      expect(playerGames.length).to.equal(1);

      const game = await gameContract.getGame(playerGames[0]);
      expect(game.player).to.equal(player1.address);
      expect(game.betAmount).to.equal(betAmount);
    });
  });

  describe("FHE加密游戏功能", function () {
    it("应该允许创建加密猜大小游戏", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef"; // 模拟加密数据

      const tx = await gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: betAmount });
      await expect(tx).to.emit(gameContract, "EncryptedGameRequested");
    });

    it("应该允许创建加密猜数字游戏", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef"; // 模拟加密数据

      const tx = await gameContract.connect(player1).createEncryptedGuessNumberGame(encryptedGuess, { value: betAmount });
      await expect(tx).to.emit(gameContract, "EncryptedGameRequested");
    });

    it("应该拒绝超出范围的下注", async function () {
      const tooSmallBet = ethers.parseEther("0.00001");
      const tooBigBet = ethers.parseEther("2.0");
      const encryptedGuess = "0x1234567890abcdef";

      await expect(
        gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: tooSmallBet })
      ).to.be.revertedWith("Bet amount out of range");

      await expect(
        gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: tooBigBet })
      ).to.be.revertedWith("Bet amount out of range");
    });

    it("应该允许所有者处理加密游戏结果", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef";
      const encryptedResult = "0xfedcba0987654321";

      // 创建加密游戏请求
      await gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: betAmount });
      
      // 获取请求ID
      const requestId = 1;
      
      // 处理游戏结果
      const tx = await gameContract.processEncryptedGameResult(requestId, encryptedResult);
      await expect(tx).to.emit(gameContract, "EncryptedGameProcessed");
    });

    it("应该拒绝非所有者处理加密游戏结果", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef";
      const encryptedResult = "0xfedcba0987654321";

      // 创建加密游戏请求
      await gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: betAmount });
      
      // 尝试用非所有者处理结果
      await expect(
        gameContract.connect(player1).processEncryptedGameResult(1, encryptedResult)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("应该正确跟踪待处理请求", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef";

      // 创建加密游戏请求
      await gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: betAmount });
      
      // 检查待处理请求
      const pendingRequests = await gameContract.getPendingRequests(player1.address);
      expect(pendingRequests.length).to.equal(1);
      expect(pendingRequests[0]).to.equal(1);
    });

    it("应该正确获取加密请求详情", async function () {
      const betAmount = ethers.parseEther("0.1");
      const encryptedGuess = "0x1234567890abcdef";

      // 创建加密游戏请求
      await gameContract.connect(player1).createEncryptedGuessSizeGame(encryptedGuess, { value: betAmount });
      
      // 获取请求详情
      const request = await gameContract.getEncryptedRequest(1);
      expect(request.requestId).to.equal(1);
      expect(request.player).to.equal(player1.address);
      expect(request.gameType).to.equal(0); // GuessSize
      expect(request.betAmount).to.equal(betAmount);
      expect(request.encryptedGuess).to.equal(encryptedGuess);
      expect(request.processed).to.be.false;
    });
  });
});
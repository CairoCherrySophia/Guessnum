import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useFHEVM } from '../context/FHEVMContext';
import { ethers } from 'ethers';
import './GameInterface.css';

import CONTRACT_CONFIG from '../config/contract';

// 使用配置文件中的ABI，并按网络动态选择地址
const CONTRACT_ABI = CONTRACT_CONFIG.ABI;

interface GameConfig {
  minBet: string;
  maxBet: string;
  platformFeePercent: number;
  houseEdgePercent: number;
}

const GameInterface: React.FC = () => {
  const { signer, isConnected, chainId } = useWeb3();
  const { isInitialized: fhevmInitialized, encryptValue } = useFHEVM();
  const [gameType, setGameType] = useState<'size' | 'number'>('size');
  const [gameMode, setGameMode] = useState<'normal' | 'encrypted'>('normal');
  const [betAmount, setBetAmount] = useState('0.0001');
  const [guessSize, setGuessSize] = useState<'big' | 'small'>('big');
  const [guessNumber, setGuessNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [poolBalance, setPoolBalance] = useState('0');
  const [lastGameResult, setLastGameResult] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<number[]>([]);

  // 获取当前网络的合约地址
  const getContractAddress = useCallback(() => {
    if (chainId === 11155111) {
      return CONTRACT_CONFIG.SEPOLIA_ADDRESS;
    }
    if (chainId === 42069) {
      return CONTRACT_CONFIG.ADDRESS;
    }
    // 本地或其它网络时，优先用主 ADDRESS（可按需扩展）
    return CONTRACT_CONFIG.ADDRESS;
  }, [chainId]);

  // 获取合约实例
  const getContract = useCallback(() => {
    if (!signer) return null;
    const address = getContractAddress();
    return new ethers.Contract(address, CONTRACT_ABI, signer);
  }, [signer, getContractAddress]);

  // 加载游戏配置和奖池余额
  const loadGameData = useCallback(async () => {
    if (!isConnected) return;

    try {
      const contract = getContract();
      if (!contract) return;

      const config = await contract.config();
      const pool = await contract.getPoolBalance();

      setGameConfig({
        minBet: ethers.formatEther(config.minBet),
        maxBet: ethers.formatEther(config.maxBet),
        platformFeePercent: Number(config.platformFeePercent),
        houseEdgePercent: Number(config.houseEdgePercent)
      });

      setPoolBalance(ethers.formatEther(pool));

      // 加载待处理的加密游戏请求
      if (gameMode === 'encrypted' && signer) {
        const address = await signer.getAddress();
        const requests = await contract.getPendingRequests(address);
        setPendingRequests(requests.map((r: any) => Number(r)));
      }
    } catch (error) {
      console.error('加载游戏数据失败:', error);
    }
  }, [isConnected, getContract, gameMode, signer]);

  useEffect(() => {
    loadGameData();
  }, [isConnected, signer, loadGameData]);

  // 监听游戏事件
  useEffect(() => {
    const contract = getContract();
    if (!contract) return;

    const handleGameCreated = (gameId: any, player: string, gameType: number, betAmount: any) => {
      console.log('游戏创建:', { gameId: gameId.toString(), player, gameType, betAmount: ethers.formatEther(betAmount) });
    };

    const handleGameResult = (gameId: any, player: string, won: boolean, reward: any) => {
      const result = won ? `恭喜！您赢得了 ${ethers.formatEther(reward)} ETH` : '很遗憾，您没有猜中';
      setLastGameResult(result);
      console.log('游戏结果:', { gameId: gameId.toString(), player, won, reward: ethers.formatEther(reward) });
    };

    contract.on('GameCreated', handleGameCreated);
    contract.on('GameResult', handleGameResult);

    return () => {
      contract.off('GameCreated', handleGameCreated);
      contract.off('GameResult', handleGameResult);
    };
  }, [signer, getContract]);

  const handleGuessSize = async () => {
    if (!isConnected || !signer) {
      alert('请先连接钱包');
      return;
    }

    try {
      setIsLoading(true);
      setLastGameResult(null);

      const contract = getContract();
      if (!contract) throw new Error('合约未初始化');

      const value = ethers.parseEther(betAmount);
      
      // 估算gas并设置gas限制
      const gasEstimate = await contract.createGuessSizeGame.estimateGas(guessSize === 'big', { value });
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100); // 增加20%的gas缓冲
      
      const tx = await contract.createGuessSizeGame(guessSize === 'big', { 
        value,
        gasLimit: gasLimit
      });
      
      console.log('交易已提交:', tx.hash);
      const receipt = await tx.wait();
      console.log('交易已确认，区块号:', receipt.blockNumber);
      
      // 重新加载游戏数据
      await loadGameData();
      
      // 从交易收据中获取游戏结果
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === 'GameResult') {
              const { gameId, player, won, reward } = parsed.args;
              const result = won ? `恭喜！您赢得了 ${ethers.formatEther(reward)} ETH` : '很遗憾，您没有猜中';
              setLastGameResult(result);
              console.log('游戏结果:', { gameId: gameId.toString(), player, won, reward: ethers.formatEther(reward) });
              break;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

    } catch (error: any) {
      console.error('游戏失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '游戏失败';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      if (error.reason) {
        errorMessage += ` (原因: ${error.reason})`;
      }
      if (error.code) {
        errorMessage += ` (错误代码: ${error.code})`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuessNumber = async () => {
    if (!isConnected || !signer) {
      alert('请先连接钱包');
      return;
    }

    try {
      setIsLoading(true);
      setLastGameResult(null);

      const contract = getContract();
      if (!contract) throw new Error('合约未初始化');

      const value = ethers.parseEther(betAmount);
      
      // 估算gas并设置gas限制
      const gasEstimate = await contract.createGuessNumberGame.estimateGas(guessNumber, { value });
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100); // 增加20%的gas缓冲
      
      const tx = await contract.createGuessNumberGame(guessNumber, { 
        value,
        gasLimit: gasLimit
      });
      
      console.log('交易已提交:', tx.hash);
      const receipt = await tx.wait();
      console.log('交易已确认，区块号:', receipt.blockNumber);
      
      // 重新加载游戏数据
      await loadGameData();
      
      // 从交易收据中获取游戏结果
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === 'GameResult') {
              const { gameId, player, won, reward } = parsed.args;
              const result = won ? `恭喜！您赢得了 ${ethers.formatEther(reward)} ETH` : '很遗憾，您没有猜中';
              setLastGameResult(result);
              console.log('游戏结果:', { gameId: gameId.toString(), player, won, reward: ethers.formatEther(reward) });
              break;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

    } catch (error: any) {
      console.error('游戏失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '游戏失败';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      if (error.reason) {
        errorMessage += ` (原因: ${error.reason})`;
      }
      if (error.code) {
        errorMessage += ` (错误代码: ${error.code})`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // FHE加密游戏处理函数
  const handleEncryptedGuessSize = async () => {
    if (!isConnected || !signer || !fhevmInitialized) {
      alert('请先连接钱包并确保FHEVM已初始化');
      return;
    }

    try {
      setIsLoading(true);
      setLastGameResult(null);

      const contract = getContract();
      if (!contract) throw new Error('合约未初始化');

      // 加密猜测值 (1=大, 0=小)
      const guessValue = guessSize === 'big' ? 1 : 0;
      const encryptedGuess = await encryptValue(guessValue);
      if (!encryptedGuess) throw new Error('加密失败');
      // 固定为 bytes32（32字节）
      const encryptedGuessHex = ethers.hexlify(encryptedGuess);
      const encryptedGuess32 = ethers.zeroPadValue(encryptedGuessHex, 32);

      const value = ethers.parseEther(betAmount);
      
      const tx = await contract.createEncryptedGuessSizeGame(encryptedGuess32, { 
        value,
        gasLimit: 1000000 // FHE操作需要更多gas
      });
      
      console.log('加密游戏交易已提交:', tx.hash);
      const receipt = await tx.wait();
      console.log('交易已确认，区块号:', receipt.blockNumber);
      
      // 重新加载游戏数据
      await loadGameData();

      // 自动结算：取该玩家最新的 pending 请求并揭示
      try {
        const address = await signer.getAddress();
        const pending = await contract.getPendingRequests(address);
        if (pending && pending.length > 0) {
          const latestId = pending[pending.length - 1];
          const decryptedGuess = guessSize === 'big' ? 1 : 0;
          const settleTx = await contract.revealAndProcessEncryptedGame(latestId, decryptedGuess, {
            gasLimit: 1000000
          });
          await settleTx.wait();
          await loadGameData();
          setLastGameResult('加密游戏已自动结算');
        }
      } catch (e) {
        console.warn('自动结算失败，可稍后在历史记录中手动结算/刷新', e);
        setLastGameResult('加密游戏请求已提交，等待处理结果...');
      }

    } catch (error: any) {
      console.error('加密游戏失败:', error);
      alert(`加密游戏失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEncryptedGuessNumber = async () => {
    if (!isConnected || !signer || !fhevmInitialized) {
      alert('请先连接钱包并确保FHEVM已初始化');
      return;
    }

    try {
      setIsLoading(true);
      setLastGameResult(null);

      const contract = getContract();
      if (!contract) throw new Error('合约未初始化');

      // 加密猜测数字
      const encryptedGuess = await encryptValue(guessNumber);
      if (!encryptedGuess) throw new Error('加密失败');
      const encryptedGuessHex = ethers.hexlify(encryptedGuess);
      const encryptedGuess32 = ethers.zeroPadValue(encryptedGuessHex, 32);

      const value = ethers.parseEther(betAmount);
      
      const tx = await contract.createEncryptedGuessNumberGame(encryptedGuess32, { 
        value,
        gasLimit: 1000000 // FHE操作需要更多gas
      });
      
      console.log('加密游戏交易已提交:', tx.hash);
      const receipt = await tx.wait();
      console.log('交易已确认，区块号:', receipt.blockNumber);
      
      // 重新加载游戏数据
      await loadGameData();

      // 自动结算：取该玩家最新的 pending 请求并揭示
      try {
        const address = await signer.getAddress();
        const pending = await contract.getPendingRequests(address);
        if (pending && pending.length > 0) {
          const latestId = pending[pending.length - 1];
          const decryptedGuess = Number(guessNumber);
          const settleTx = await contract.revealAndProcessEncryptedGame(latestId, decryptedGuess, {
            gasLimit: 1000000
          });
          await settleTx.wait();
          await loadGameData();
          setLastGameResult('加密游戏已自动结算');
        }
      } catch (e) {
        console.warn('自动结算失败，可稍后在历史记录中手动结算/刷新', e);
        setLastGameResult('加密游戏请求已提交，等待处理结果...');
      }

    } catch (error: any) {
      console.error('加密游戏失败:', error);
      alert(`加密游戏失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (gameMode === 'encrypted') {
      if (gameType === 'size') {
        handleEncryptedGuessSize();
      } else {
        handleEncryptedGuessNumber();
      }
    } else {
      if (gameType === 'size') {
        handleGuessSize();
      } else {
        handleGuessNumber();
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="game-interface">
        <div className="not-connected">
          <h3>请先连接钱包</h3>
          <p>连接您的 MetaMask 钱包以开始游戏</p>
        </div>
      </div>
    );
  }

  // 检查网络是否正确
  const isFhenix = chainId === 42069;
  const isSepolia = chainId === 11155111;
  const isLocalhost = chainId === 31337 || chainId === 1337;
  
  if (!isFhenix && !isSepolia && !isLocalhost) {
    return (
      <div className="game-interface">
        <div className="wrong-network">
          <h3>网络错误</h3>
          <p>请切换到支持的网络：Fhenix、Sepolia 或本地网络</p>
          <p>当前网络: {chainId === 1 ? '以太坊主网' : `链ID: ${chainId}`}</p>
          <p>请点击钱包连接按钮自动切换网络</p>
        </div>
      </div>
    );
  }

  // 检查FHEVM是否可用
  if (gameMode === 'encrypted' && !fhevmInitialized) {
    return (
      <div className="game-interface">
        <div className="fhevm-error">
          <h3>FHEVM 未初始化</h3>
          <p>加密游戏需要 Fhenix 网络和 FHEVM 支持</p>
          <p>请确保您已连接到 Fhenix 测试网</p>
          <button onClick={() => setGameMode('normal')} className="switch-mode-btn">
            切换到普通模式
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-interface">
      <div className="game-info">
        <div className="pool-balance">
          <span className="label">奖池余额:</span>
          <span className="value">{parseFloat(poolBalance).toFixed(4)} ETH</span>
        </div>
        {gameConfig && (
          <div className="game-config">
            <span className="label">下注范围:</span>
            <span className="value">{gameConfig.minBet} - {gameConfig.maxBet} ETH</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="game-form">
        <div className="game-mode-selector">
          <h3>选择游戏模式</h3>
          <div className="mode-buttons">
            <button
              type="button"
              className={`mode-btn ${gameMode === 'normal' ? 'active' : ''}`}
              onClick={() => setGameMode('normal')}
            >
              普通模式
            </button>
            <button
              type="button"
              className={`mode-btn ${gameMode === 'encrypted' ? 'active' : ''}`}
              onClick={() => setGameMode('encrypted')}
              disabled={false}
            >
              加密模式
            </button>
          </div>
        </div>

        <div className="game-type-selector">
          <h3>选择游戏类型</h3>
          <div className="type-buttons">
            <button
              type="button"
              className={`type-btn ${gameType === 'size' ? 'active' : ''}`}
              onClick={() => setGameType('size')}
            >
              猜大小 (1:1)
            </button>
            <button
              type="button"
              className={`type-btn ${gameType === 'number' ? 'active' : ''}`}
              onClick={() => setGameType('number')}
            >
              猜数字 (1:5)
            </button>
          </div>
        </div>

        <div className="bet-amount">
          <label htmlFor="betAmount">下注金额 (ETH)</label>
          <input
            type="number"
            id="betAmount"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="输入下注金额"
            step="0.001"
            min={gameConfig?.minBet || "0.001"}
            max={gameConfig?.maxBet || "1.0"}
            required
          />
        </div>

        {gameType === 'size' ? (
          <div className="guess-size">
            <h4>选择大小</h4>
            <div className="size-buttons">
              <button
                type="button"
                className={`size-btn ${guessSize === 'big' ? 'active' : ''}`}
                onClick={() => setGuessSize('big')}
              >
                大 ({'>'}3)
              </button>
              <button
                type="button"
                className={`size-btn ${guessSize === 'small' ? 'active' : ''}`}
                onClick={() => setGuessSize('small')}
              >
                小 (≤3)
              </button>
            </div>
          </div>
        ) : (
          <div className="guess-number">
            <h4>选择数字 (1-6)</h4>
            <div className="number-buttons">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`number-btn ${guessNumber === num ? 'active' : ''}`}
                  onClick={() => setGuessNumber(num)}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="submit-btn"
          disabled={isLoading || !betAmount || parseFloat(betAmount) <= 0}
        >
          {isLoading ? '游戏中...' : (gameMode === 'encrypted' ? '开始加密游戏' : '开始游戏')}
        </button>

        {lastGameResult && (
          <div className="game-result">
            {lastGameResult}
          </div>
        )}

        {gameMode === 'encrypted' && pendingRequests.length > 0 && (
          <div className="pending-requests">
            <h4>待处理的加密游戏请求</h4>
            <div className="request-list">
              {pendingRequests.map(requestId => (
                <div key={requestId} className="request-item">
                  请求ID: {requestId} - 等待处理结果
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default GameInterface;

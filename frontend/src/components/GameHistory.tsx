import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { ethers } from 'ethers';
import type { EventLog } from 'ethers';
import './GameHistory.css';

import CONTRACT_CONFIG from '../config/contract';

// 使用配置文件中的ABI，并按网络动态选择地址
const CONTRACT_ABI = CONTRACT_CONFIG.ABI;

interface EncryptedGameRecord {
  requestId: number;
  player: string;
  gameType: number; // 0=size, 1=number
  betAmount: string; // ETH
  processed: boolean;
  won: boolean;
  reward: string; // ETH
  timestamp: number;
}

interface GameRecord {
  gameId: number;
  player: string;
  gameType: number;
  betAmount: string;
  guess: number;
  result: number;
  status: number;
  timestamp: number;
  reward: string;
}

const GameHistory: React.FC = () => {
  const { signer, account, isConnected, chainId } = useWeb3();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [encryptedGames, setEncryptedGames] = useState<EncryptedGameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取当前网络的合约地址
  const getContractAddress = useCallback(() => {
    if (chainId === 11155111) {
      return CONTRACT_CONFIG.SEPOLIA_ADDRESS;
    }
    if (chainId === 42069) {
      return CONTRACT_CONFIG.ADDRESS;
    }
    return CONTRACT_CONFIG.ADDRESS;
  }, [chainId]);

  // 获取合约实例
  const getContract = useCallback(() => {
    if (!signer) return null;
    const address = getContractAddress();
    return new ethers.Contract(address, CONTRACT_ABI, signer);
  }, [signer, getContractAddress]);

  // 加载游戏历史
  const loadGameHistory = useCallback(async () => {
    if (!isConnected || !account) return;

    try {
      setIsLoading(true);
      setError(null);

      const contract = getContract();
      if (!contract) throw new Error('合约未初始化');

      // 获取玩家的游戏ID列表
      const gameIds = await contract.getPlayerGames(account);
      console.log('玩家游戏ID列表:', gameIds.map((id: any) => id.toString()));

      // 获取每个游戏的详细信息
      const gamePromises = gameIds.map(async (gameId: any) => {
        const gameData = await contract.getGame(gameId);
        return {
          gameId: Number(gameId),
          player: gameData.player,
          gameType: Number(gameData.gameType),
          betAmount: ethers.formatEther(gameData.betAmount),
          guess: Number(gameData.guess),
          result: Number(gameData.result),
          status: Number(gameData.status),
          timestamp: Number(gameData.timestamp),
          reward: ethers.formatEther(gameData.reward)
        };
      });

      const gameRecords = await Promise.all(gamePromises);
      
      // 按时间倒序排列
      gameRecords.sort((a, b) => b.timestamp - a.timestamp);
      
      setGames(gameRecords);

      // ==== 加密游戏历史（事件回放） ====
      const provider = signer!.provider!;
      const reqFilter = contract.filters.EncryptedGameRequested(null, account);
      const procFilter = contract.filters.EncryptedGameProcessed(null, account);

      const [reqEvents, procEvents] = await Promise.all([
        contract.queryFilter(reqFilter, 0, 'latest'),
        contract.queryFilter(procFilter, 0, 'latest'),
      ]);

      const procMap: Record<string, { won: boolean; reward: string; blockNumber: number }> = {};
      for (const ev of procEvents) {
        const evLog = ev as EventLog;
        const args: any = evLog.args;
        if (!args) continue;
        procMap[args.requestId.toString()] = {
          won: Boolean(args.won),
          reward: ethers.formatEther(args.reward as bigint),
          blockNumber: evLog.blockNumber ?? 0,
        };
      }

      const encRecords: EncryptedGameRecord[] = [];
      for (const ev of reqEvents) {
        const evLog = ev as EventLog;
        const args: any = evLog.args;
        if (!args) continue;
        const requestId = Number(args.requestId);
        const gameType = Number(args.gameType);
        const betAmount = ethers.formatEther(args.betAmount as bigint);
        const processed = procMap[requestId.toString()] !== undefined;
        const won = processed ? procMap[requestId.toString()].won : false;
        const reward = processed ? procMap[requestId.toString()].reward : '0';
        const blockNum = evLog.blockNumber ?? 0;
        const block = blockNum ? await provider.getBlock(blockNum) : null;
        const timestamp = block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

        encRecords.push({ requestId, player: account, gameType, betAmount, processed, won, reward, timestamp });
      }

      encRecords.sort((a, b) => b.timestamp - a.timestamp);
      setEncryptedGames(encRecords);
    } catch (err: any) {
      console.error('加载游戏历史失败:', err);
      setError(err.message || '加载游戏历史失败');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, account, getContract, signer]);

  useEffect(() => {
    loadGameHistory();
  }, [loadGameHistory]);

  const getGameTypeName = (gameType: number) => {
    return gameType === 0 ? '猜大小' : '猜数字';
  };

  const getGuessDisplay = (gameType: number, guess: number) => {
    if (gameType === 0) { // 猜大小游戏
      return guess === 1 ? '大' : '小';
    } else { // 猜数字游戏
      return guess.toString();
    }
  };

  const getResultDisplay = (gameType: number, result: number) => {
    if (gameType === 0) { // 猜大小游戏
      return result > 3 ? '大' : '小';
    } else { // 猜数字游戏
      return result.toString();
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 0: return '进行中';
      case 1: return '获胜';
      case 2: return '失败';
      default: return '未知';
    }
  };

  const getStatusClass = (status: number) => {
    switch (status) {
      case 0: return 'status-pending';
      case 1: return 'status-won';
      case 2: return 'status-lost';
      default: return 'status-unknown';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  };


  if (!isConnected) {
    return (
      <div className="game-history">
        <div className="not-connected">
          <h3>请先连接钱包</h3>
          <p>连接您的 MetaMask 钱包以查看游戏历史</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-history">
      <div className="history-header">
        <h3>游戏历史记录</h3>
        <button 
          className="refresh-btn"
          onClick={loadGameHistory}
          disabled={isLoading}
        >
          {isLoading ? '加载中...' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>加载游戏历史中...</p>
        </div>
      ) : (
        <>
          {/* 普通模式记录 */}
          {games.length === 0 ? (
            <div className="no-games">
              <h4>暂无普通模式记录</h4>
            </div>
          ) : (
            <div className="games-list">
              {games.map((game) => (
                <div key={`normal-${game.gameId}`} className="game-item">
                  <div className="game-header">
                    <div className="game-id">普通 #{game.gameId}</div>
                    <div className={`game-status ${getStatusClass(game.status)}`}>
                      {getStatusText(game.status)}
                    </div>
                  </div>
                  
                  <div className="game-details">
                    <div className="detail-row">
                      <span className="label">类型:</span>
                      <span className="value">{getGameTypeName(game.gameType)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">下注:</span>
                      <span className="value">{parseFloat(game.betAmount).toFixed(4)} ETH</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">猜测:</span>
                      <span className="value">{getGuessDisplay(game.gameType, game.guess)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">结果:</span>
                      <span className="value">{getResultDisplay(game.gameType, game.result)}</span>
                    </div>
                    {game.status === 1 && (
                      <div className="detail-row">
                        <span className="label">奖励:</span>
                        <span className="value reward">{parseFloat(game.reward).toFixed(4)} ETH</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">时间:</span>
                      <span className="value">{formatTimestamp(game.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 加密模式记录 */}
          {encryptedGames.length === 0 ? (
            <div className="no-games">
              <h4>暂无加密模式记录</h4>
            </div>
          ) : (
            <div className="games-list">
              {encryptedGames.map((g) => (
                <div key={`enc-${g.requestId}`} className="game-item">
                  <div className="game-header">
                    <div className="game-id">加密请求 #{g.requestId}</div>
                    <div className={`game-status ${g.processed ? (g.won ? 'status-won' : 'status-lost') : 'status-pending'}`}>
                      {g.processed ? (g.won ? '获胜' : '失败') : '进行中'}
                    </div>
                  </div>
                  <div className="game-details">
                    <div className="detail-row">
                      <span className="label">类型:</span>
                      <span className="value">{getGameTypeName(g.gameType)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">下注:</span>
                      <span className="value">{parseFloat(g.betAmount).toFixed(4)} ETH</span>
                    </div>
                    {g.processed && (
                      <div className="detail-row">
                        <span className="label">奖励:</span>
                        <span className="value reward">{parseFloat(g.reward).toFixed(4)} ETH</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">时间:</span>
                      <span className="value">{formatTimestamp(g.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GameHistory;

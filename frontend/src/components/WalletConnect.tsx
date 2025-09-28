import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import './WalletConnect.css';

const WalletConnect: React.FC = () => {
  const { 
    account, 
    chainId, 
    connectWallet, 
    disconnectWallet, 
    isConnected, 
    isLoading, 
    error 
  } = useWeb3();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 42069:
        return 'Fhenix Testnet';
      case 1:
        return 'Ethereum Mainnet';
      case 11155111:
        return 'Sepolia Testnet';
      default:
        return `Chain ${chainId}`;
    }
  };

  if (isConnected) {
    return (
      <div className="wallet-connect">
        <div className="wallet-info">
          <div className="wallet-address">
            <span className="label">钱包地址:</span>
            <span className="address">{formatAddress(account!)}</span>
          </div>
          <div className="wallet-network">
            <span className="label">网络:</span>
            <span className="network">{getNetworkName(chainId)}</span>
          </div>
        </div>
        <button 
          className="disconnect-btn"
          onClick={disconnectWallet}
        >
          断开连接
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <div className="connect-prompt">
        <h3>连接钱包开始游戏</h3>
        <p>请连接您的 MetaMask 钱包以参与游戏</p>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <button 
          className="connect-btn"
          onClick={connectWallet}
          disabled={isLoading}
        >
          {isLoading ? '连接中...' : '连接钱包'}
        </button>
      </div>
    </div>
  );
};

export default WalletConnect;

import React, { useState } from 'react';
import './App.css';
import WalletConnect from './components/WalletConnect';
import GameInterface from './components/GameInterface';
import GameHistory from './components/GameHistory';
import { Web3Provider, useWeb3 } from './context/Web3Context';
import { FHEVMProvider } from './context/FHEVMContext';

// 内部应用组件，需要访问Web3上下文
function AppContent() {
  const [activeTab, setActiveTab] = useState('game');
  const { chainId } = useWeb3();

  return (
    <FHEVMProvider chainId={chainId || 0}>
      <div className="App">
        <header className="App-header">
          <h1>🎲 猜大小/猜数字</h1>
          <p>基于 FHEVM 的安全链游</p>
        </header>
        
        <main className="App-main">
          <WalletConnect />
          
          <div className="tab-container">
            <button 
              className={`tab ${activeTab === 'game' ? 'active' : ''}`}
              onClick={() => setActiveTab('game')}
            >
              游戏
            </button>
            <button 
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              历史记录
            </button>
          </div>
          
          {activeTab === 'game' && <GameInterface />}
          {activeTab === 'history' && <GameHistory />}
        </main>
        
        <footer className="App-footer">
          <p>Powered by FHEVM 0.7 | 安全 · 透明 · 公平</p>
        </footer>
      </div>
    </FHEVMProvider>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;
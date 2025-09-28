import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!account && !!provider;

  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      // 请求账户访问
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('未找到账户');
      }

      // 创建提供者
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      // 检查网络是否为Fhenix测试网或Sepolia测试网
      const isFhenix = Number(network.chainId) === 42069;
      const isSepolia = Number(network.chainId) === 11155111;
      
      if (!isFhenix && !isSepolia) {
        try {
          // 优先尝试切换到Fhenix测试网（支持FHEVM）
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa455' }], // 42069 in hex
          });
        } catch (switchError: any) {
          // 如果Fhenix网络不存在，则添加它
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xa455',
                  chainName: 'Fhenix Testnet',
                  nativeCurrency: {
                    name: 'Fhenix Ether',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: ['https://api.testnet.fhenix.zone:7747'],
                  blockExplorerUrls: ['https://explorer.testnet.fhenix.zone'],
                }],
              });
            } catch (addError) {
              // 如果添加Fhenix失败，尝试Sepolia
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
                });
              } catch (sepoliaError: any) {
                if (sepoliaError.code === 4902) {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0xaa36a7',
                      chainName: 'Sepolia Testnet',
                      nativeCurrency: {
                        name: 'Sepolia Ether',
                        symbol: 'ETH',
                        decimals: 18,
                      },
                      rpcUrls: ['https://sepolia.drpc.org'],
                      blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    }],
                  });
                } else {
                  throw new Error('请手动切换到Fhenix或Sepolia测试网');
                }
              }
            }
          } else {
            throw new Error('请手动切换到Fhenix或Sepolia测试网');
          }
        }
        
        // 重新获取网络信息
        const newNetwork = await provider.getNetwork();
        setChainId(Number(newNetwork.chainId));
      } else {
        setChainId(Number(network.chainId));
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);

      // 监听账户变化
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
        }
      });

      // 监听网络变化
      window.ethereum.on('chainChanged', (chainId: string) => {
        setChainId(Number(chainId));
        // 重新加载页面以更新网络
        window.location.reload();
      });

    } catch (err: any) {
      console.error('连接钱包失败:', err);
      setError(err.message || '连接钱包失败');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setError(null);
  };

  // 检查是否已经连接
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: 'eth_accounts',
          });

          if (accounts.length > 0) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();

            setProvider(provider);
            setSigner(signer);
            setAccount(accounts[0]);
            setChainId(Number(network.chainId));
          }
        } catch (err) {
          console.error('检查连接状态失败:', err);
        }
      }
    };

    checkConnection();
  }, []);

  const value: Web3ContextType = {
    provider,
    signer,
    account,
    chainId,
    connectWallet,
    disconnectWallet,
    isConnected,
    isLoading,
    error,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// 扩展 Window 接口以包含 ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

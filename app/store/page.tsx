"use client";
import Footer from "@/components/Footer";
import { WalletConnect } from "@/components/walletConnect";
import { useEthersProvider, useEthersSigner } from "@/hooks/useEthers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { ethers } from "ethers";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { avalanche, avalancheFuji, base, baseSepolia } from "wagmi/chains";

type FaucetChain = typeof base | typeof baseSepolia | typeof avalanche | typeof avalancheFuji;

const SUPPORTED_CHAINS: FaucetChain[] = [base, baseSepolia, avalanche, avalancheFuji];

export default function Faucet() {
    const { isConnected, address } = useAccount();
    const connectedChainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const [selectedId, setSelectedId] = useState<number>(baseSepolia.id);
    const [isMinting, setIsMinting] = useState(false);
    const [mintError, setMintError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<any>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isStoring, setIsStoring] = useState(false);
    const [storeError, setStoreError] = useState<string | null>(null);
    const [storeSuccess, setStoreSuccess] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [readError, setReadError] = useState<string | null>(null);
    const [storedImageUrl, setStoredImageUrl] = useState<string | null>(null);
    const [retrievedCid, setRetrievedCid] = useState<string | null>(null);
    const selectedChain = useMemo(() => SUPPORTED_CHAINS.find((c) => c.id === selectedId)!, [selectedId]);
    const isMatching = connectedChainId === selectedId;
    const [uploading, setUploading] = useState(false)

  // Sync selected chain to connected wallet network
  useEffect(() => {
    if (connectedChainId && connectedChainId !== selectedId) {
      setSelectedId(connectedChainId);
    }
  }, [connectedChainId]);

  const signer = useEthersSigner();
  const provider = useEthersProvider();

  // Lighthouse API key - replace with your actual API key
  const LIGHTHOUSE_API_KEY = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY || "YOUR_API_KEY";

  const progressCallback = (progressData: any) => {
    const percentageDone = ((progressData?.uploaded / progressData?.total) * 100)?.toFixed(2);
    setUploadProgress(parseFloat(percentageDone) || 0);
    console.log(percentageDone);
  };

  const onUploadChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY
    if (!apiKey) {
      setUploadError("Lighthouse API key not configured")
      return
    }
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)
    try {
      const { default: lighthouse } = await import("@lighthouse-web3/sdk")
      const progressCallback = (progressData: any) => {
        try {
          const pct =
            100 -
            Number(
              (
                (progressData?.total / progressData?.uploaded) as number
              ).toFixed(2)
            )
          if (!Number.isNaN(pct)) setUploadProgress(pct)
        } catch {}
      }
      const output = await lighthouse.upload(
        files,
        apiKey,
        undefined,
        progressCallback
      )
      const cid = output?.data?.Hash as string | undefined
      if (!cid) throw new Error("Upload failed: no CID returned")
     
      setUploadedFile(output)
      setUploadProgress(100)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

    const handleMint = useCallback(async () => {
        if (!isConnected || !isMatching) return;
        const faucetAddress = CONTRACT_ADDRESS;
        try {
            setIsMinting(true);
      setMintError(null);
            
            if (!provider || !signer) {
                throw new Error("Please connect your wallet");
            }

            const contract = new ethers.Contract(
                faucetAddress,
                CONTRACT_ABI as ethers.InterfaceAbi,
                signer
            );
            const tx = await contract.mint();
            await tx.wait();
    } catch (e) {
      const err = e as unknown as { reason?: string; shortMessage?: string; message?: string };
      const reason = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
      setMintError(reason);
    } finally {
            setIsMinting(false);
        }
  }, [isConnected, isMatching, provider, signer]);

  const handleStore = useCallback(async () => {
    if (!isConnected || !isMatching || !uploadedFile) return;
    const faucetAddress = CONTRACT_ADDRESS;
    try {
      setIsStoring(true);
      setStoreError(null);
      setStoreSuccess(false);
      
      if (!provider || !signer) {
        throw new Error("Please connect your wallet");
      }

      const contract = new ethers.Contract(
        faucetAddress,
        CONTRACT_ABI as ethers.InterfaceAbi,
        signer
      );
      
      const cid = uploadedFile.data.Hash;
      const tx = await contract.store(cid);
      await tx.wait();
      setStoreSuccess(true);
    } catch (e) {
      const err = e as unknown as { reason?: string; shortMessage?: string; message?: string };
      const reason = err?.reason || err?.shortMessage || err?.message || "Store transaction failed";
      setStoreError(reason);
    } finally {
      setIsStoring(false);
    }
  }, [isConnected, isMatching, provider, signer, uploadedFile]);

  // Load stored CID and image URL
  useEffect(() => {
    const loadStored = async () => {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
      const hasSigner = Boolean(signer);
      const hasRpc = Boolean(rpcUrl);
      if (!hasSigner && !hasRpc) return;

      const faucetAddress = CONTRACT_ADDRESS;
      try {
        setIsReading(true);
        setReadError(null);
        setStoredImageUrl(null);
        setRetrievedCid(null);

        const readProvider = hasSigner ? signer!.provider : new ethers.JsonRpcProvider(rpcUrl!);
        const contract = new ethers.Contract(
          faucetAddress,
          CONTRACT_ABI as ethers.InterfaceAbi,
          readProvider
        );

        const cid = await contract.retrieve();
        setRetrievedCid(cid);
        if (cid && cid !== "") {
          setStoredImageUrl(`https://gateway.lighthouse.storage/ipfs/${cid}`);
        }
      } catch (e) {
        const err = e as unknown as { reason?: string; shortMessage?: string; message?: string };
        const reason = err?.reason || err?.shortMessage || err?.message || "Failed to read stored CID";
        setReadError(reason);
      } finally {
        setIsReading(false);
      }
    };

    loadStored();
  }, [signer, storeSuccess]);

    return (
        <div className="min-h-screen bg-white-pattern">
            {/* Hero/Header */}
            <section className="min-h-screen flex flex-col justify-between pb-10 md:pb-20">
                <div className="flex justify-between items-center pt-20 md:pt-32 container mx-auto px-4 md:px-16 ">
                    <Link href="/">
                        <Image
                            className="cursor-pointer"
                            src="/assets/logos/logo.svg"
                            width={150}
                            height={150}
                            alt="Randamu Logo"
                        />
                    </Link>
                    <div className="flex items-center">
                        {!isConnected ? (
                            <WalletConnect />
                        ) : (
                            <div className="flex items-center space-x-2">
                                <span className="font-funnel-display text-xl text-gray-600">
                                    Hello, {address?.slice(0, 6)}...{address?.slice(-4)} 👋
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content - Two Sections */}
                {isConnected && (
                    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-4">
                        {/* Upload & Store Section */}
                        <div className="flex flex-col items-center space-y-4 w-full lg:w-1/2">
                            <h2 className="font-funnel-display text-2xl font-bold text-black mb-4">
                                Upload & Store Image
                            </h2>
                            {isConnected && !isMatching && (
                                <div className="w-full max-w-md p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-yellow-800 font-funnel-display">
                                            You are on the wrong network. Please switch to the expected chain.
                                        </p>
                                        <button
                                            onClick={() => switchChain({ chainId: selectedId })}
                                            disabled={isSwitching}
                                            className={`ml-3 px-3 py-1.5 rounded-md text-sm font-funnel-display font-semibold transition-colors ${
                                                isSwitching ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                            }`}
                                        >
                                            {isSwitching ? 'Switching...' : 'Switch Network'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    id="file-upload"
                                    onChange={(e) => onUploadChange(e.target.files)}
                                    disabled={isUploading}
                                />
                                <label
                                    htmlFor="file-upload"
                                    className={`flex flex-col items-center justify-center w-96 h-64 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                                        isUploading 
                                            ? 'border-blue-400 bg-blue-50' 
                                            : 'border-gray-300 bg-white hover:border-gray-400'
                                    }`}
                                >
                                    <div className="flex flex-col items-center space-y-3">
                                        {isUploading ? (
                                            <div className="flex flex-col items-center space-y-2">
                                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                                <p className="text-sm text-blue-600 font-funnel-display">
                                                    Uploading... {uploadProgress.toFixed(0)}%
                                                </p>
                                            </div>
                                        ) : uploadedFile ? (
                                            <div className="flex flex-col items-center space-y-2">
                                                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <p className="text-sm text-green-600 font-funnel-display">
                                                    Upload successful!
                                                </p>
                                                <p className="text-xs text-gray-500 font-funnel-display">
                                                    IPFS Hash: {uploadedFile.data.Hash.slice(0, 10)}...
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <svg
                                                    className="w-12 h-12 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={1.5}
                                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                    />
                                                </svg>
                                                <div className="text-center">
                                                    <p className="text-lg font-semibold text-gray-700 font-funnel-display">
                                                        Upload a photo
                                                    </p>
                                                    <p className="text-sm text-gray-500 font-funnel-display">
                                                        Drag and drop or click to browse
                                                    </p>
                                                    <p className="text-xs text-gray-400 font-funnel-display mt-1">
                                                        PNG, JPG up to 10MB
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </label>
                            </div>
                            {uploadError && (
                                <p className="text-sm text-red-600 font-funnel-display mt-2">
                                    {uploadError}
                                </p>
                            )}
                            {uploadedFile && (
                                <div className="mt-4 space-y-3">
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-800 font-funnel-display">
                                            File uploaded to IPFS! 
                                            <a 
                                                href={`https://gateway.lighthouse.storage/ipfs/${uploadedFile.data.Hash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 text-blue-600 hover:underline"
                                            >
                                                View file
                                            </a>
                                        </p>
                                    </div>
                                    
                                    {/* Store Button */}
                                    <div className="flex flex-col items-center space-y-2">
                                        <button
                                            onClick={handleStore}
                                            disabled={isStoring || !isConnected || !isMatching || !uploadedFile}
                                            className={`px-6 py-3 rounded-lg font-funnel-display font-semibold transition-colors ${
                                                isStoring || !isConnected || !isMatching || !uploadedFile
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        >
                                            {isStoring ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Storing...</span>
                                                </div>
                                            ) : (
                                                'Store on Blockchain'
                                            )}
                                        </button>
                                        
                                        {storeError && (
                                            <p className="text-sm text-red-600 font-funnel-display">
                                                {storeError}
                                            </p>
                                        )}
                                        
                                        {storeSuccess && (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <p className="text-sm text-green-800 font-funnel-display">
                                                    ✅ Successfully stored on blockchain!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Read & Display Section */}
                        <div className="flex flex-col items-center space-y-4 w-full lg:w-1/2">
                            <h2 className="font-funnel-display text-2xl font-bold text-black mb-4">
                                Stored Image
                            </h2>
                            <div className="w-full max-w-md">
                                {isReading && (
                                    <div className="flex items-center justify-center space-x-2 py-8">
                                        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        <span className="text-blue-600 font-funnel-display">Loading stored image...</span>
                                    </div>
                                )}

                                {readError && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-sm text-red-600 font-funnel-display">{readError}</p>
                                    </div>
                                )}

                                {retrievedCid && !isReading && (
                                    <div className="mb-3">
                                        <p className="text-xs text-gray-500 font-funnel-display">CID: {retrievedCid}</p>
                                    </div>
                                )}

                                {storedImageUrl && !isReading && (
                                    <div className="space-y-3">
                                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                            <img
                                                src={storedImageUrl}
                                                alt="Stored image from blockchain"
                                                className="w-full h-auto max-h-96 object-contain"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {!isReading && !storedImageUrl && !readError && (
                                    <div className="p-8 text-center text-gray-500">
                                        <p className="font-funnel-display">No image stored on blockchain</p>
                                        <p className="text-sm mt-2">Upload and store an image to see it here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
}
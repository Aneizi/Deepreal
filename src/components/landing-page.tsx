import { Button } from './ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogTrigger, DialogOverlay, DialogPortal } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useWalletUi, useWalletUiWallet, UiWallet } from '@wallet-ui/react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useSolana } from '@/components/solana/use-solana.tsx';
import { useNavigate } from 'react-router';

function WalletAvatar({ className, wallet }: { className?: string; wallet: UiWallet }) {
  return (
    <Avatar className={cn('rounded-md h-6 w-6', className)}>
      <AvatarImage src={wallet.icon} alt={wallet.name} />
      <AvatarFallback>{wallet.name[0]}</AvatarFallback>
    </Avatar>
  )
}

function WalletSelectionItem({ wallet, onSelect }: { wallet: UiWallet; onSelect: () => void }) {
  const { connect } = useWalletUiWallet({ wallet })

  const handleConnect = async () => {
    try {
      await connect()
      onSelect() // Close the modal after successful connection
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-3 h-12"
      onClick={handleConnect}
    >
      {wallet.icon ? <WalletAvatar wallet={wallet} /> : null}
      {wallet.name}
    </Button>
  )
}

export function LandingPage() {
  const { wallets } = useWalletUi()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const solana = useSolana()
  const navigate = useNavigate()
  const isWalletConnected = !!solana.account

  const handleMainButtonClick = () => {
    if (isWalletConnected) {
      navigate('/upload')
    } else {
      setIsDialogOpen(true)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative">
      <div className="absolute inset-0 w-full bg-contain md:bg-cover bg-top bg-no-repeat mix-blend-difference -mt-16 md:mt-0" style={{ backgroundImage: 'url(/Background.png.png)' }} />
      <div className="text-center space-y-18 w-full max-w-6xl mx-auto relative z-10 px-4 py-[200px]">
        {/* Hero Section with narrower max-width */}
        <div className="max-w-xl mx-auto space-y-16">
          {/* Main Heading */}
          <h1 className="text-2xl md:text-4xl lg:text-5x font-bold leading-tight mb-4">
            Combating deepfakes with digital signatures stored on Solana.
          </h1>

          {/* Description */}
          <p className="text-base text-muted-foreground leading-relaxed mb-6">
            Make your mark on every post. Add a scannable QR watermark that proves your content's origin and stays verifiable no matter how far it spreads.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            {isWalletConnected ? (
              <Button className="font-medium" onClick={handleMainButtonClick}>
                Protect your content
              </Button>
            ) : (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="font-medium">
                    Connect wallet to start
                  </Button>
                </DialogTrigger>
                <DialogPortal>
                  <DialogOverlay className="backdrop-blur-md bg-black/70" />
                  <DialogPrimitive.Content
                    className={cn(
                      'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-md',
                    )}
                  >
                    <DialogHeader>
                      <DialogTitle>Select Wallet</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      {wallets.length ? (
                        wallets.map((wallet) => (
                          <WalletSelectionItem 
                            key={wallet.name} 
                            wallet={wallet} 
                            onSelect={() => setIsDialogOpen(false)}
                          />
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-muted-foreground mb-4">No wallets detected</p>
                          <Button variant="outline" asChild>
                            <a href="https://solana.com/solana-wallets" target="_blank" rel="noopener noreferrer">
                              Get a Solana wallet
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                    <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </DialogPrimitive.Content>
                </DialogPortal>
              </Dialog>
            )}
            <Button
              variant="secondary"
              className="font-medium"
            >
              How it works
            </Button>
          </div>
        </div>

        {/* Three Cards */}
        <div className="flex flex-col md:flex-row gap-6 pt-12 w-full mx-auto">
          <Card className="flex-1 backdrop-blur-xl bg-white/5 dark:bg-black/5 border-white/20 dark:border-white/10 shadow-2xl shadow-purple-500/10">
            <CardHeader className="text-left space-y-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Step 1</p>
                <CardTitle className="text-xl leading-[30px]">Protect your content with a digital signature</CardTitle>
              </div>
              <CardDescription className="text-left text-base">
                Upload your photo or video and we'll create a cryptographic watermark that proves it's yours. Your signature travels with the content wherever it's shared.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="flex-1 backdrop-blur-xl bg-white/5 dark:bg-black/5 border-white/20 dark:border-white/10 shadow-2xl shadow-purple-500/10">
            <CardHeader className="text-left space-y-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Step 2</p>
                <CardTitle className="text-xl leading-[30px]">Share anywhere with built-in verification</CardTitle>
              </div>
              <CardDescription className="text-left text-base">
                Download your stamped content and post it on any platform. The watermark keeps your authorship visible and verifiable, even after reposts or edits.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="flex-1 backdrop-blur-xl bg-white/5 dark:bg-black/5 border-white/20 dark:border-white/10 shadow-2xl shadow-purple-500/10">
            <CardHeader className="text-left space-y-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Step 3</p>
                <CardTitle className="text-xl leading-[30px]">Keep your proof on the blockchain forever</CardTitle>
              </div>
              <CardDescription className="text-left text-base">
                Every piece of content is stored with a permanent record on Solana, giving you timeless proof that it came from you and no one else.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
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
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0 bg-cover bg-top bg-no-repeat mix-blend-difference" style={{ backgroundImage: 'url(/Background.png.png)' }} />
      <div className="text-center space-y-12 mx-auto relative z-10 px-4">
        {/* Main Heading */}
        <h1 className="text-2xl md:text-4xl lg:text-5x max-w-xl mx-auto font-bold leading-tight mb-4 mt-[120px]">
          Combating deepfakes with digital signatures on-chain
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-6">
          Verify your videos and photos with a QR watermark that proves
          authorship, stored on Solana.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          {isWalletConnected ? (
            <Button className="font-medium" onClick={handleMainButtonClick}>
              Upload content
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

        {/* Three Cards */}
        <div className="flex flex-col gap-8 pt-12 w-full max-w-auto mx-auto">
          <Card>
            <CardHeader className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  1
                </div>
                <CardTitle>Upload & Protect</CardTitle>
              </div>
              <CardDescription className="text-left">
                Generate a cryptographic watermark for your content
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  2
                </div>
                <CardTitle>Download & Share</CardTitle>
              </div>
              <CardDescription className="text-left">
                Share your watermarked content on social media
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  3
                </div>
                <CardTitle>Verify Forever</CardTitle>
              </div>
              <CardDescription className="text-left">
                Permanent verification stored on blockchain
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
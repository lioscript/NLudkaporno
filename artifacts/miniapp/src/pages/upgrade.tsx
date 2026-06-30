import { useState } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useGetInventory, useListGifts, useUpgradeGift } from "@workspace/api-client-react";
import { GiftCard } from "@/components/gift-card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Zap, Trophy, Frown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Gift } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { getGetInventoryQueryKey } from "@workspace/api-client-react";

export default function Upgrade() {
  const [, setLocation] = useLocation();
  const { initData } = useTelegram();
  const queryClient = useQueryClient();
  
  const { data: inventoryData, isLoading: isLoadingInventory } = useGetInventory(
    { initData },
    { query: { enabled: true } }
  );
  
  const { data: catalogData, isLoading: isLoadingCatalog } = useListGifts();

  const inventory = inventoryData?.inventory || [];
  const catalog = catalogData || [];

  const [step, setStep] = useState<1 | 2>(1);
  const [betGift, setBetGift] = useState<Gift | null>(null);
  const [targetGift, setTargetGift] = useState<Gift | null>(null);

  const upgradeMutation = useUpgradeGift({
    mutation: {
      onSuccess: (data) => {
        // Update inventory cache locally
        queryClient.setQueryData(getGetInventoryQueryKey({ initData }), (old: any) => {
          return { ...old, inventory: data.newInventory };
        });
        setResult(data);
      }
    }
  });

  const [result, setResult] = useState<{ win: boolean; chance: number; newInventory: Gift[] } | null>(null);

  const calculateChance = (betPrice: number, targetPrice: number) => {
    return Math.min((betPrice / targetPrice) * 82, 82);
  };

  const currentChance = betGift && targetGift ? calculateChance(betGift.price, targetGift.price) : 0;

  const handleBetSelect = (gift: Gift) => {
    setBetGift(gift);
    // If target gift is now invalid (cheaper than bet), clear it
    if (targetGift && targetGift.price <= gift.price) {
      setTargetGift(null);
    }
  };

  const handleUpgrade = () => {
    if (!betGift || !targetGift) return;
    upgradeMutation.mutate({
      data: {
        initData,
        betGiftName: betGift.name,
        targetGiftName: targetGift.name
      }
    });
  };

  const reset = () => {
    setResult(null);
    setStep(1);
    setBetGift(null);
    setTargetGift(null);
    if (!inventoryData?.inventory?.length) {
      setLocation("/");
    }
  };

  if (isLoadingInventory || isLoadingCatalog) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col relative pb-28">
      <header className="p-4 flex items-center sticky top-0 bg-background/90 backdrop-blur z-20 border-b border-border">
        <Link href="/" className="mr-4 block">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Upgrade Gift</h1>
          <p className="text-xs text-muted-foreground">
            {step === 1 ? "Select a gift to bet" : "Select target gift"}
          </p>
        </div>
      </header>

      {/* Selected Items Summary Bar */}
      <div className="px-4 py-3 bg-card/30 border-b border-border flex items-center justify-between sticky top-[65px] z-10 backdrop-blur">
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Your Bet</span>
          {betGift ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate max-w-[100px]">{betGift.name}</span>
            </div>
          ) : (
            <span className="text-sm opacity-50">None</span>
          )}
        </div>
        <div className="px-3 text-muted-foreground flex flex-col items-center">
          <ChevronRight className="w-5 h-5" />
          {betGift && targetGift && (
            <span className="text-[10px] font-bold text-accent mt-1">{currentChance.toFixed(2)}%</span>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Target</span>
          {targetGift ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate max-w-[100px]">{targetGift.name}</span>
            </div>
          ) : (
            <span className="text-sm opacity-50">None</span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1">
        {step === 1 ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-lg font-bold mb-4">Choose from your inventory</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {inventory.map((gift, idx) => (
                <GiftCard 
                  key={`${gift.name}-${idx}`} 
                  name={gift.name} 
                  price={gift.price} 
                  image={gift.image}
                  selected={betGift?.name === gift.name}
                  onClick={() => handleBetSelect(gift)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold mb-4">Choose target to win</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {catalog.map((gift, idx) => {
                const isValidTarget = betGift && gift.price > betGift.price;
                const chance = betGift ? calculateChance(betGift.price, gift.price) : 0;
                
                return (
                  <div key={`${gift.name}-${idx}`} className="relative">
                    <GiftCard 
                      name={gift.name} 
                      price={gift.price} 
                      image={gift.image}
                      selected={targetGift?.name === gift.name}
                      onClick={() => isValidTarget && setTargetGift(gift)}
                      disabled={!isValidTarget}
                    />
                    {isValidTarget && (
                      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded px-1.5 py-0.5 text-[10px] font-bold text-accent border border-accent/20">
                        {chance.toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-20">
        {step === 1 ? (
          <Button 
            size="lg" 
            className="w-full text-lg h-14" 
            disabled={!betGift}
            onClick={() => setStep(2)}
          >
            Next Step
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="lg" variant="outline" className="h-14 px-4" onClick={() => setStep(1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button 
              size="lg" 
              className={cn(
                "flex-1 text-lg font-bold h-14 shadow-lg",
                targetGift ? "bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent/20" : ""
              )}
              disabled={!targetGift || upgradeMutation.isPending}
              onClick={handleUpgrade}
            >
              {upgradeMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2 fill-current" />
                  UPGRADE NOW
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!result} onOpenChange={() => { if(result) reset() }}>
        <DialogContent className="sm:max-w-md bg-card border-border text-center overflow-hidden">
          <div className={cn(
            "absolute inset-0 opacity-10 pointer-events-none",
            result?.win ? "bg-green-500" : "bg-destructive"
          )} />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center mb-2 flex items-center justify-center">
              {result?.win ? (
                <span className="text-green-500 flex items-center justify-center gap-2">
                  <Trophy className="w-8 h-8" /> UPGRADE SUCCESS!
                </span>
              ) : (
                <span className="text-destructive flex items-center justify-center gap-2">
                  <Frown className="w-8 h-8" /> UPGRADE FAILED
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              {result?.win ? (
                <span>You successfully upgraded to <strong>{targetGift?.name}</strong>!</span>
              ) : (
                <span>You lost your <strong>{betGift?.name}</strong>. Better luck next time!</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center my-6">
            {result?.win && targetGift ? (
              <div className="animate-in zoom-in spin-in-12 duration-500">
                <GiftCard name={targetGift.name} price={targetGift.price} image={targetGift.image} className="w-40 border-green-500 shadow-green-500/30 shadow-xl" />
              </div>
            ) : betGift ? (
              <div className="animate-in zoom-out slide-out-to-bottom-8 duration-500 opacity-50 grayscale">
                <GiftCard name={betGift.name} price={betGift.price} image={betGift.image} className="w-40 border-destructive" />
              </div>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button size="lg" className="w-full h-12 text-lg font-bold" onClick={reset}>
              {result?.win ? "AWESOME" : "TRY AGAIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

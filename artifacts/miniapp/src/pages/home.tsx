import { useTelegram } from "@/hooks/use-telegram";
import { useGetInventory } from "@workspace/api-client-react";
import { GiftCard } from "@/components/gift-card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Home() {
  const { initData, isTestMode } = useTelegram();
  const { data: inventoryData, isLoading, error } = useGetInventory(
    { initData },
    { query: { enabled: true } }
  );

  const inventory = inventoryData?.inventory || [];

  return (
    <div className="min-h-[100dvh] w-full bg-background p-4 pb-24 text-foreground flex flex-col">
      {isTestMode && (
        <Alert variant="destructive" className="mb-4 bg-destructive/20 text-destructive-foreground border-destructive/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Test Mode</AlertTitle>
          <AlertDescription>
            Running outside Telegram. Inventory might be unavailable.
          </AlertDescription>
        </Alert>
      )}

      <header className="mb-6 mt-4">
        <h1 className="text-3xl font-black bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent tracking-tight">
          My Gifts
        </h1>
        <p className="text-muted-foreground mt-1">Select a gift to upgrade to a better one.</p>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <p className="text-destructive/80 font-medium">Failed to load inventory.</p>
        </div>
      ) : inventory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-4">
          <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-2">
            <span className="text-3xl opacity-50">0</span>
          </div>
          <h2 className="text-xl font-bold">Your inventory is empty</h2>
          <p className="text-muted-foreground text-sm max-w-[250px]">
            You don't have any gifts yet. Play or trade to get some!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inventory.map((gift, idx) => (
            <GiftCard 
              key={`${gift.name}-${idx}`} 
              name={gift.name} 
              price={gift.price} 
              image={gift.image} 
            />
          ))}
        </div>
      )}

      {inventory.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border z-10">
          <Link href="/upgrade" className="block w-full">
            <Button size="lg" className="w-full text-lg font-bold shadow-lg shadow-primary/25 group h-14">
              UPGRADE GIFTS
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

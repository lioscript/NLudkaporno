import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface GiftCardProps {
  name: string;
  price: number;
  image?: string | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function GiftCard({ name, price, image, selected, onClick, className, disabled }: GiftCardProps) {
  const imageUrl = image ? (image.startsWith('/') ? `/api${image}` : `/api/${image}`) : null;
  
  return (
    <Card 
      onClick={disabled ? undefined : onClick}
      className={cn(
        "relative overflow-hidden flex flex-col items-center justify-between p-4 transition-all duration-200 border-2 cursor-pointer bg-card/50 backdrop-blur-sm",
        selected ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]" : "border-transparent hover:border-primary/50",
        disabled && "opacity-50 grayscale pointer-events-none cursor-not-allowed",
        className
      )}
      data-testid={`gift-card-${name}`}
    >
      <div className="flex-1 flex items-center justify-center w-full aspect-square mb-3">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-contain drop-shadow-xl" />
        ) : (
          <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">No Image</span>
          </div>
        )}
      </div>
      <div className="text-center w-full">
        <h3 className="font-bold text-sm leading-tight mb-1 truncate text-foreground">{name}</h3>
        <div className="flex items-center justify-center gap-1 text-primary">
          <Star className="w-4 h-4 fill-primary" />
          <span className="font-bold">{price.toLocaleString()}</span>
        </div>
      </div>
      {selected && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </Card>
  );
}

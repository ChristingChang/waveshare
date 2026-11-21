import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIONS, getSpotsByRegion, type Region } from "@shared/surfSpots";

interface SpotSelectorProps {
  value: string;
  onChange: (spotName: string) => void;
  required?: boolean;
}

export function SpotSelector({ value, onChange, required = false }: SpotSelectorProps) {
  const [userRegion, setUserRegion] = useState<Region | "">("");
  const selectedRegion = userRegion || REGIONS.find(region => getSpotsByRegion(region).includes(value)) || "";
  const availableSpots = selectedRegion ? getSpotsByRegion(selectedRegion) : [];

  return (
    <div className="space-y-4">
      {/* Region Selector */}
      <div className="space-y-2">
        <Label htmlFor="region" className="text-card-foreground">
          地區 {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={selectedRegion}
          onValueChange={(region) => {
            if (!region) return;
            setUserRegion(region as Region);
            if (region !== selectedRegion) {
              onChange("");
            }
          }}
        >
          <SelectTrigger id="region">
            <SelectValue placeholder="選擇地區" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Spot Selector */}
      <div className="space-y-2">
        <Label htmlFor="spot" className="text-card-foreground">
          浪點 {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={value}
          onValueChange={(spot) => {
            if (spot) onChange(spot);
          }}
          disabled={!selectedRegion}
        >
          <SelectTrigger id="spot">
            <SelectValue placeholder={selectedRegion ? "選擇浪點" : "請先選擇地區"} />
          </SelectTrigger>
          <SelectContent>
            {availableSpots.map((spot) => (
              <SelectItem key={spot} value={spot}>
                {spot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

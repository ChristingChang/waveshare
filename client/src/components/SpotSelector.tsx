import { useState, useEffect } from "react";
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
  const [selectedRegion, setSelectedRegion] = useState<Region | "">("");
  const availableSpots = selectedRegion ? getSpotsByRegion(selectedRegion) : [];

  // Initialize region based on current value
  useEffect(() => {
    if (value && !selectedRegion) {
      // Find which region contains this spot
      for (const region of REGIONS) {
        const spots = getSpotsByRegion(region);
        if (spots.includes(value)) {
          setSelectedRegion(region);
          break;
        }
      }
    }
  }, [value]);

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
            setSelectedRegion(region as Region);
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
          onValueChange={onChange}
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

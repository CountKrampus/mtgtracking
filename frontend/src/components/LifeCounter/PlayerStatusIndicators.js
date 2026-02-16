import React from 'react';
import { Zap, Star, Shield, Sword, Heart, Activity } from 'lucide-react';

function PlayerStatusIndicators({ player }) {
  const indicators = [];

  // Add indicators based on player status
  if (player.hasPhyrexianPoison) {
    indicators.push({
      icon: Heart,
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      label: 'Phyrexian Poison'
    });
  }

  if (player.hasDaybound) {
    indicators.push({
      icon: Star,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20',
      label: 'Daybound'
    });
  }

  if (player.hasNightbound) {
    indicators.push({
      icon: Star,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      label: 'Nightbound'
    });
  }

  if (player.hasTransformed) {
    indicators.push({
      icon: Zap,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      label: 'Transformed'
    });
  }

  if (player.hasHexproof) {
    indicators.push({
      icon: Shield,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      label: 'Hexproof'
    });
  }

  if (player.hasShroud) {
    indicators.push({
      icon: Shield,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/20',
      label: 'Shroud'
    });
  }

  if (player.hasProtection) {
    indicators.push({
      icon: Shield,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/20',
      label: 'Protection'
    });
  }

  if (player.hasVigilance) {
    indicators.push({
      icon: Activity,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/20',
      label: 'Vigilance'
    });
  }

  if (player.hasDoubleStrike) {
    indicators.push({
      icon: Sword,
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      label: 'Double Strike'
    });
  }

  if (player.hasTrample) {
    indicators.push({
      icon: Sword,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      label: 'Trample'
    });
  }

  if (indicators.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {indicators.map((indicator, index) => {
        const Icon = indicator.icon;
        return (
          <div
            key={index}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${indicator.bgColor} ${indicator.color}`}
            title={indicator.label}
          >
            <Icon size={12} />
            <span className="capitalize">{indicator.label.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default PlayerStatusIndicators;
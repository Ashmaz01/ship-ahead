import crew0 from '../assets/crew/crew-0.webp';
import crew1 from '../assets/crew/crew-1.webp';
import crew2 from '../assets/crew/crew-2.webp';
import crew3 from '../assets/crew/crew-3.webp';
import crew4 from '../assets/crew/crew-4.webp';
import crew5 from '../assets/crew/crew-5.webp';

export const CREW = [
  { name: 'Navigator', color: '#2DD4BF', skin: '#C9815A', hair: '#392536', gear: '#F6C74B' },
  { name: 'Mechanic', color: '#60A5FA', skin: '#A96545', hair: '#292632', gear: '#6DBBFF' },
  { name: 'Lookout', color: '#F472B6', skin: '#EDAF8C', hair: '#35232D', gear: '#F6A1B9' },
  { name: 'Radio Scout', color: '#A3E635', skin: '#8A513D', hair: '#25252C', gear: '#D7E085' },
  { name: 'Diver', color: '#E2E8F0', skin: '#F0BC91', hair: '#70452B', gear: '#E7ECF7' },
  { name: 'Skipper', color: '#FDBA74', skin: '#B57657', hair: '#432B37', gear: '#FF9358' },
] as const;

export const crewIndex = (color: string): number =>
  Math.max(0, CREW.findIndex((member) => member.color === color.toUpperCase()));

export const crewSprites = [
  crew0,
  crew1,
  crew2,
  crew3,
  crew4,
  crew5,
];

export function crewArt(index: number): string {
  return `<img src="${crewSprites[index]}" alt="" class="crew-portrait">`;
}

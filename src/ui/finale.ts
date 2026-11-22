import island from '../assets/volcano.webp';
import ferry from '../assets/rescue-ferry.webp';
import { crewArt, crewIndex } from './crew';
import { esc } from './html';
import { cue } from '../sound';
import type { Player } from '../rules/game';

interface Place { player: Player; rank: number }
declare global { interface Window { ResultBanner?: { setVisible(visible: boolean): void } } }

export function showFinale(layer: HTMLElement, places: Place[], actions: string) {
  const escaped = ({ player, rank }: Place) => player.boarded || rank === 1;
  const crew = (seats: Place[]) => seats.map(({player}) =>
    `<span class="final-passenger">${crewArt(crewIndex(player.color))}<b>${esc(player.name)}</b></span>`).join('');
  const aboard = places.filter(escaped);
  const onShore = places.filter(place => !escaped(place));
  const winners = places.filter(place => place.rank === 1).map(place => esc(place.player.name)).join(' &amp; ');
  const heading = winners + (places.filter(place => place.rank === 1).length > 1 ? ' share first place!' : ' wins!');
  layer.innerHTML = `<section class="screen finish-film">
    <div class="finish-stage" style="background-image:url('${island}')">
      <div class="finish-ash" aria-hidden="true"></div>
      <div class="finish-shore">${crew(onShore)}</div>
      <div class="finish-ferry"><img class="finish-hull" src="${ferry}" alt="Rescue ferry"><div>${crew(aboard)}</div></div>
    </div><h1>The volcano erupts!</h1><p>${aboard.map(p => esc(p.player.name)).join(' &amp; ')} escaped by ferry.</p>
    <button class="btn-secondary" data-skip-scene>Show results</button></section>`;
  const scene = layer.firstElementChild!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cue('eruption');
  function results() {
    if (!scene.isConnected) return;
    clearTimeout(timer);
    layer.innerHTML = `<section class="screen setup" aria-label="Final results"><h1>${heading}</h1>
      <ol class="standings">${places.map(p => `<li><span>${p.rank}</span>${crewArt(crewIndex(p.player.color))}<b>${esc(p.player.name)} · ${escaped(p) ? 'Escaped' : 'On the island'}</b><span>${p.player.points} pts</span></li>`).join('')}</ol>${actions}</section>`;
    window.ResultBanner?.setVisible(true);
    layer.querySelector('button')?.focus();
  }
  const timer = window.setTimeout(results, reduced ? 1200 : 5000);
  scene.querySelector('button')!.onclick = results;
}

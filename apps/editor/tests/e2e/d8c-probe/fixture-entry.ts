import { mount } from 'svelte';
import FixtureProbe from './FixtureProbe.svelte';

const target = document.getElementById('probe');
if (target === null) throw new Error('the probe root is missing');
mount(FixtureProbe, { target });

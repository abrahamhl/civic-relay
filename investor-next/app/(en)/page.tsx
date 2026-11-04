import type {Metadata} from 'next';
import SendaExperience from '../senda-experience';
export const metadata:Metadata={
 title:'SENDA — When the network goes dark | Offline emergency routing, wildfire and rail prevention',
 description:'SENDA routes emergency messages over any surviving channel (neighbours, LoRa, satellite, drones) and computes where people are, when a wildfire reaches each town and which track to inspect. Live demos run the tested code.',
 openGraph:{title:'SENDA — When the network goes dark',description:'Live, tested demos: k-of-n multi-bearer delivery, end-to-end encryption, evidence fusion, wildfire alerts before masts burn, rail anomaly detection, satellites.',locale:'en_GB',type:'website'},
 alternates:{canonical:'/',languages:{en:'/',es:'/es/',nl:'/nl/'}}
};
export default function Home(){return <SendaExperience locale="en"/>;}

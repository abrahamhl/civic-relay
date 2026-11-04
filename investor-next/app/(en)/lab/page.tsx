import type {Metadata} from 'next';
import InvestorPage from '../../investor-page';
export const metadata:Metadata={title:'SENDA · Full lab (previous experience)',alternates:{canonical:'/lab/',languages:{en:'/lab/',es:'/es/lab/',nl:'/nl/lab/'}}};
export default function Lab(){return <InvestorPage locale="en"/>;}

declare module 'lucide-react/dist/esm/icons/*' {
  import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'
  
  export interface LucideProps extends Partial<Omit<SVGProps<SVGSVGElement>, 'ref'>> {
    size?: string | number
    absoluteStrokeWidth?: boolean
  }
  
  export type LucideIcon = ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >
  
  const icon: LucideIcon
  export default icon
}

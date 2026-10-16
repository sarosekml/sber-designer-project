import { Components } from '@mui/material';
import { alpha, Theme } from '@mui/system';
import { emerald } from '../colors';
import SBSansDisplayLightWoff2 from '../../assets/fonts/SBSansDisplay/SBSansDisplay-Light.woff2';
import SBSansDisplayRegularWoff2 from '../../assets/fonts/SBSansDisplay/SBSansDisplay-Regular.woff2';
import SBSansDisplaySemiBoldWoff2 from '../../assets/fonts/SBSansDisplay/SBSansDisplay-SemiBold.woff2';
import SBSansTextLightWoff2 from '../../assets/fonts/SBSansText/SBSansText-Light.woff2';
import SBSansTextRegularWoff2 from '../../assets/fonts/SBSansText/SBSansText-Regular.woff2';
import SBSansTextSemiBoldWoff2 from '../../assets/fonts/SBSansText/SBSansText-Semibold.woff2';
import SBSansTextCondRegularWoff2 from '../../assets/fonts/SBSansTextCond/SBSansTextCond-Regular.woff2';
import SBSansScreenWoff2 from '../../assets/fonts/SBSansScreen/SBSansScreen.woff2';

export const components: Components<Omit<Theme, 'components'>> = {
  MuiCssBaseline: {
    styleOverrides: `
        @font-face {
          font-family: SB Sans Display;
          src: local('SB Sans Display Light'), local('SBSansDisplayLight'), url(${SBSansDisplayLightWoff2}) format('woff2');
          font-style: normal;
          font-weight: 300;
        };
        @font-face {
          font-family: SB Sans Display;
          src: local('SB Sans Display Regular'), local('SBSansDisplayRegular'), url(${SBSansDisplayRegularWoff2}) format('woff2');
          font-style: normal;
          font-weight: 400;
        };
         @font-face {
          font-family: SB Sans Display;
          src: local('SB Sans Display SemiBold'), local('SBSansDisplaySemiBold'), url(${SBSansDisplaySemiBoldWoff2}) format('woff2');
          font-style: normal;
          font-weight: 600;
        };
        @font-face {
          font-family: SB Sans Text;
          src: local('SB Sans Text Light'), local('SBSansTextLight'), url(${SBSansTextLightWoff2}) format('woff2');
          font-style: normal;
          font-weight: 300;
        }
         @font-face {
          font-family: SB Sans Text;
          src: local('SB Sans Text Regular'), local('SBSansTextRegular'), url(${SBSansTextRegularWoff2}) format('woff2');
          font-style: normal;
          font-weight: 400;
        };
         @font-face {
          font-family: SB Sans Text;
          src: local('SB Sans Text SemiBold'), local('SBSansTextSemiBold'), url(${SBSansTextSemiBoldWoff2}) format('woff2');
          font-style: normal;
          font-weight: 600;
        };
        @font-face {
          font-family: SB Sans Text Cond;
          src: local('SB Sans Text Cond Regular'), local('SBSansTextCondRegular'), url(${SBSansTextCondRegularWoff2}) format('woff2');
          font-style: normal;
          font-weight: 400;
        };
        @font-face {
          font-family: SB Sans Screen;
          src: local('SB Sans Screen'), local('SBSansScreen'), url(${SBSansScreenWoff2}) format('woff2');
          font-style: normal;
          font-weight: 400;
        };

        /* Scrollbar overriding */
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        };
        *::-webkit-scrollbar-thumb {
          border-radius: 15px;
          background-color: ${alpha(emerald[600], 0.3)};
        };
        *::-webkit-scrollbar-thumb:hover {
          background-color: ${alpha(emerald[600], 0.5)};
        };
        * {
          /* For Firefox */
          scrollbar-color: ${alpha(emerald[600], 0.3)} ${alpha(emerald[600], 0.03)};
          scrollbar-width: thin;
        };
      `,
  },
};

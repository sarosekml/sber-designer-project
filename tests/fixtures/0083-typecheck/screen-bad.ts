import { makeIcon, makeText } from './kit';

// Wrong prop name (`iconName` instead of `name`) — the DCM `<Icon iconName>` bug.
makeIcon({ iconName: 'Edit' });

// Invalid union token — the DCM `Text type="Body_M_Regular"` bug.
makeText('Body_M_Regular');

import * as shell from 'shelljs';

shell.cp('-R', ['lib/views', 'credentials.yaml'], 'dist/');

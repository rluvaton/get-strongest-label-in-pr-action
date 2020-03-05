require('jest-extended');
const nock = require('nock');
const path = require('path');
const {run, OutputErrorCodes} = require('./action');
const core = require('@actions/core');
const github = require('@actions/github');

describe('Action test suite', () => {

    let envSnapshot;

    /**
     * core.setFailed spy
     * @type {jest.SpyInstance<ReturnType<Required<*>[string]>, jest.ArgsType<Required<*>[string]>>}
     */
    let setFailedSpy;

    /**
     * core.error spy
     * @type {jest.SpyInstance<ReturnType<Required<*>[string]>, jest.ArgsType<Required<*>[string]>>}
     */
    let errorSpy;

    const responsePayload = require('../test-files/getClosedPullRequestsPayload');

    beforeEach(() => {
        // Save current env
        envSnapshot = {...(process.env)};

        setFailedSpy = jest.spyOn(core, 'setFailed').mockImplementation();
        errorSpy = jest.spyOn(core, 'error').mockImplementation();
    });

    afterEach(() => {
        // Restore
        process.env = envSnapshot;
        setFailedSpy.mockClear();
        errorSpy.mockClear();
    });

    /**
     * Mock Input
     * @param {Array<{key: string, value: string}|[string, string]>} input
     */
    function mockInputs(input) {
        input.forEach((item) => {
            const {key, value} = Array.isArray(item) ? {key: item[0], value: item[1]} : item;
            process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`] = value;
        });
    }

    /**
     * Mock Github context
     * @param {Array<{key: string, value: string}|[string, string]>} input
     */
    function mockGitHubContext(input) {
        input.forEach((item) => {
            const {key, value} = Array.isArray(item) ? {key: item[0], value: item[1]} : item;
            process.env[`GITHUB_${key.toUpperCase()}`] = value;
        });
    }

    describe('#run', () => {

        describe('input validation', () => {
            describe('labels input', () => {
                it('should fail when there is no labels', async () => {
                    const errorMessage = 'Error on parsing input labels. Error Message: Input can\'t be null';
                    const runResultPr = run();

                    await expect(runResultPr).toReject();
                    const runResultMessage = await runResultPr.catch((e) => e.message);
                    expect(runResultMessage).toEqual(errorMessage);

                    expect(setFailedSpy).toBeCalledTimes(1);
                    expect(setFailedSpy).toBeCalledWith(errorMessage);
                });

                it('should fail when the labels are in JSON object and not array', async () => {
                    mockInputs([['labels', '{}']]);
                    const errorMessage = 'Error on parsing input labels. Error Message: JSON Input must be an array';
                    const runResultPr = run();

                    await expect(runResultPr).toReject();
                    const runResultMessage = await runResultPr.catch((e) => e.message);
                    expect(runResultMessage).toEqual(errorMessage);

                    expect(setFailedSpy).toBeCalledTimes(1);
                    expect(setFailedSpy).toBeCalledWith(errorMessage);
                });

                it('should fail when there is one label object without labelName (labels are in JSON array format)', async () => {
                    mockInputs([['labels', '[{"value": "useless"}]']]);
                    const errorMessage = 'Error on parsing input labels. Error Message: No labelName in json input';
                    const runResultPr = run();

                    await expect(runResultPr).toReject();
                    const runResultMessage = await runResultPr.catch((e) => e.message);
                    expect(runResultMessage).toEqual(errorMessage);

                    expect(setFailedSpy).toBeCalledTimes(1);
                    expect(setFailedSpy).toBeCalledWith(errorMessage);
                });
            });

            describe('Github token input', () => {
                it('should fail when no token provided', async () => {
                    mockInputs([['labels', '[["label", "value"]]']]);
                    const errorMessage = 'No GitHub Token';
                    const runResultPr = run();

                    await expect(runResultPr).toReject();
                    const runResultMessage = await runResultPr.catch((e) => e.message);
                    expect(runResultMessage).toEqual(errorMessage);

                    expect(setFailedSpy).toBeCalledTimes(1);
                    expect(setFailedSpy).toBeCalledWith(errorMessage);
                });
            });
        });

        it('should set output.error to be OutputErrorCodes.NO_PULL_REQUEST (no pull request) when the event is `push` and there is no pull request with the requested merge commit', async () => {
            const testRepoOwner = 'testUser';
            const testRepoName = 'testRepo';

            mockInputs([['labels', '[["label", "value"]]'], ['GitHubToken', 'some token']]);
            mockGitHubContext([
                ['REPOSITORY', `${testRepoOwner}/${testRepoName}`],
                ['EVENT_PATH', path.join(__dirname, './test-files/pushEventPayload.json')],
                ['SHA', 'CommitSHA']
            ]);

            const setOutputSpy = jest.spyOn(core, 'setOutput').mockImplementation();
            const infoSpy = jest.spyOn(core, 'info').mockImplementation();

            nock('https://api.github.com')
                // .persist()
                .get(`/repos/${testRepoOwner}/${testRepoName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`)
                .reply(200, responsePayload);

            await run();

            expect(setOutputSpy).toHaveBeenLastCalledWith('error', OutputErrorCodes.NO_PULL_REQUEST);

            expect(infoSpy).toBeCalledTimes(1);
            expect(infoSpy).toBeCalledWith('Not a pull request');

            setOutputSpy.mockClear();
            infoSpy.mockClear();

            nock.cleanAll();
        });

        it('should set output.error to be OutputErrorCodes.NO_WANTED_LABEL (no label from list matching) when the event is `push` and there is pull request with the requested merge commit and without the requested label', async () => {
            const testRepoOwner = 'testUser';
            const testRepoName = 'testRepo';

            mockInputs([['labels', '[["label", "value"]]'], ['GitHubToken', 'some token']]);
            mockGitHubContext([
                ['REPOSITORY', `${testRepoOwner}/${testRepoName}`],
                ['EVENT_PATH', path.join(__dirname, './test-files/pushEventPayload.json')]
            ]);

            const setOutputSpy = jest.spyOn(core, 'setOutput').mockImplementation();
            const infoSpy = jest.spyOn(core, 'info').mockImplementation();

            // Mock SHA of the simulated push
            Object.defineProperty(github.context, 'sha', {
                get: jest.fn(() => 'some-valid-commit-sha'),
                set: jest.fn()
            });

            nock('https://api.github.com')
                .get(`/repos/${testRepoOwner}/${testRepoName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`)
                .reply(200, responsePayload);

            await run();

            expect(setOutputSpy).toHaveBeenLastCalledWith('error', OutputErrorCodes.NO_WANTED_LABEL);


            expect(infoSpy).toBeCalledTimes(1);
            expect(infoSpy).toBeCalledWith('pull request labels don\'t contain one of your labels');

            setOutputSpy.mockClear();
            infoSpy.mockClear();

            nock.cleanAll();
        });

        it('should set output.error to be OutputErrorCodes.NO_ERROR (no pull request) when the event is `push` and there is pull request with the requested merge commit and requested label', async () => {
            const testRepoOwner = 'testUser';
            const testRepoName = 'testRepo';

            const labelName = 'bump:patch';
            const labelValue = 'patch';

            mockInputs([['labels', `[["${labelName}", "${labelValue}"]]`], ['GitHubToken', 'some token']]);
            mockGitHubContext([
                ['REPOSITORY', `${testRepoOwner}/${testRepoName}`],
                ['EVENT_PATH', path.join(__dirname, './test-files/pushEventPayload.json')]
            ]);

            // Mock SHA of the simulated push
            Object.defineProperty(github.context, 'sha', {
                get: jest.fn(() => 'some-valid-commit-sha'),
                set: jest.fn()
            });

            const setOutputSpy = jest.spyOn(core, 'setOutput').mockImplementation();

            nock('https://api.github.com')
                .get(`/repos/${testRepoOwner}/${testRepoName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`)
                .reply(200, responsePayload);

            const runResultPr = run();

            await expect(runResultPr).toResolve();

            expect(setOutputSpy).toBeCalledTimes(3);
            expect(setOutputSpy).toBeCalledWith('strongestLabelName', labelName);
            expect(setOutputSpy).toBeCalledWith('strongestLabelValue', labelValue);
            expect(setOutputSpy).toBeCalledWith('error', OutputErrorCodes.NO_ERROR);

            expect(setFailedSpy).toBeCalledTimes(0);

            setOutputSpy.mockClear();

            nock.cleanAll();
        });
    });

});

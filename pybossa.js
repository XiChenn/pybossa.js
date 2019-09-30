/*! pybossa.js library

Copyright (C) 2015 SciFabric LTD.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

(function(pybossa, $, undefined) {
    var url = '/';

    //AJAX calls
    function _userProgress(projectname) {
        return $.ajax({
            url: url + 'api/project/' + projectname + '/userprogress',
            cache: false,
            dataType: 'json'
        });
    }

    function _fetchProject(projectname) {
        return $.ajax({
            url: url + 'api/project',
            data: 'all=1&short_name='+projectname,
            dataType:'json'
        });
    }

    function _newTaskUrl(projectId) {
        var seg = window.pybossa.isGoldMode ? '/taskgold' : '/newtask'
        return url + 'api/project/' + projectId + seg
    }

    function _fetchNewTask(projectId, offset) {
        offset = offset || 0;
        return $.ajax({
            url: _newTaskUrl(projectId),
            data: 'offset=' + offset,
            cache: false,
            dataType: 'json'
        });
    }

    function _fetchTask(taskId) {
        return $.ajax({
            url: url + 'api/task/' + taskId,
            cache: false,
            dataType: 'json'
        });
    }

    function _postRequest(url, data){
        return $.ajax({
            type: 'POST',
            url: url,
            dataType: 'json',
            contentType: 'application/json',
            data: data
        });
    }

    function _saveTaskRun(taskrun, projectId) {
        var requestUrl = url + 'api/taskrun';
        if(window.pybossa.isGoldMode){
            requestUrl = url + 'api/project/' + projectId + '/taskgold';
        }
        return _postRequest(requestUrl, taskrun);
    }

    function _cancelTask(projectname, taskId) {
        var data = {
            'projectname': projectname
        };
        return $.ajax({
            type: 'POST',
            url: url + 'api/task/' + taskId + '/canceltask',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(data)
        });
    }

    function _fetchLock(taskId) {
        return $.ajax({
            url: url + 'api/task/' + taskId + '/lock',
            cache: false,
            dataType: 'json'
        });
    }

    // Private methods
    function _getProject(projectname){
        return _fetchProject(projectname)
        .then(function(data) {return data[0];});
    }

    function _getNewTask(project) {
        return _fetchNewTask(project.id)
        .then(_addProjectDescription.bind(undefined, project));
    }

    function _addProjectDescription(project, task) {
        return { question: project.description, task: task};
        }

    function _addAnswerToTask(task, answer) {
        task.answer = answer;
        return task;
    }

    function _createTaskRun(answer, task) {
        task = _addAnswerToTask(task, answer);
        var taskrun = {
            'project_id': task.project_id,
            'task_id': task.id,
            'info': task.answer
        };
        taskrun = JSON.stringify(taskrun);
        return _saveTaskRun(taskrun, task.project_id).then(function(data) {
            if(window.pybossa.isGoldMode && !window.pybossa.isBulk){
                setTimeout(function(){
                    window.opener.location.reload(true);
                    window.top.close();
                }, 100);
            }
            return data;});
    }

    function _getCurrentTaskId(url) {
        pathArray = url.split('/');
        if (url.indexOf('/task/')!=-1) {
            var l = pathArray.length;
            var i = 0;
            for (i=0;i<l;i++) {
                if (pathArray[i]=='task') {
                    return pathArray[i+1];
                }
            }
        }
        return false;
    }

    // fallback for user defined action
    var _taskLoaded = function(task, deferred) {
        deferred.resolve(task);
    };

    var _presentTask = function(task, deferred) {
        deferred.resolve(task);
    };

    function _setUserTaskLoaded (userFunc) {
        _taskLoaded = userFunc;
    }

    function _setUserPresentTask (userFunc) {
        _presentTask = userFunc;
    }
    function _setTpHidden (value){
        tpElement = document.getElementById('task-presenter-section');
        if (tpElement){
            tpElement.hidden = value;
        }
    }
    function _getNotificationMessage(userProgress){
        var quiz = userProgress.quiz;
        var config = quiz.config;
        var inQuizMode = quiz && config.enabled && quiz.status === 'in_progress' && ((quiz.result.right > 0 || quiz.result.wrong > 0));
        var quizStarted = quiz && config.enabled && quiz.status === 'in_progress' && (quiz.result.right === 0 && quiz.result.wrong === 0);
        var outOfGoldenTasks = quiz && config.enabled && userProgress.available_gold_tasks === 0 && quiz.status === 'in_progress' && !window.pybossa.isGoldMode;
        var outOfNoneGoldTask =  userProgress.available_gold_tasks === userProgress.remaining && window.pybossa.isGoldMode;
        var failedQuiz = quiz && config.enabled && quiz.status === 'failed';
        var passedQuiz = quiz && config.enabled && quiz.status === 'passed';
        var projectCompleted = quiz && userProgress.remaining_for_user === 0 && quiz.status !== 'in_progress';
        var inGoldMode = window.pybossa.isGoldMode && !outOfNoneGoldTask;

        var outOfGoldenTasksMessage = 'We have run out of quiz questions for you. Please notify the project owner.';
        var inGoldModeMessage = 'In Gold Mode';
        var outOfNoneGoldTaskMessage = 'In gold mode, there are no task available.';
        var failedQuizMessage = 'Thank you for taking the quiz. You got ' + quiz.result.right + ' correct out of ' + quiz.config.questions + ' tasks. You have been blocked from working on this job. The administrator of this job will contact you with next steps.';
        var passedQuizMessage = 'Thank you for taking the quiz. You got ' + quiz.result.right + ' correct out of ' + quiz.config.questions + ' tasks. You will now be able to work on this job.';
        var projectCompletedMessage = 'Congratulations, you have completed the job.';
        var inQuizMode = 'In quiz mode';
        var quizStartedMessage = 'You must complete a quiz successfully before you can work on this job.';

        if ((outOfGoldenTasks || projectCompleted || failedQuiz) && !window.pybossa.isGoldMode) {
            _setTpHidden(true);
        }
        if (outOfGoldenTasks)
            return outOfGoldenTasksMessage;
        else if (inGoldMode)
            return inGoldModeMessage;
        else if (outOfNoneGoldTask)
            return outOfNoneGoldTaskMessage;
        else if (failedQuiz)
            return failedQuizMessage;
        else if (passedQuiz)
            return passedQuizMessage;
        else if (projectCompleted)
            return projectCompletedMessage;
        else if (quizStarted)
            return quizStartedMessage;
        else if (inQuizMode)
            return inQuizMode;

    }

    function _displayBanner(){
      var regex = new RegExp('/project/([^/]+)');
      var match = window.location.href.match(regex);
      var projectName;
      if (match) {
        projectName = match[1];
      }
      _userProgress(projectName).then(data => {
        var message = _getNotificationMessage(data);
        if(message){
            pybossaNotify(message, true, 'warning');
        }
        });
    }

    function _resolveNextTaskLoaded(task, deferred) {
        _displayBanner();
        var udef = $.Deferred();
        _taskLoaded(task, udef);
        udef.done(function(task) {
            deferred.resolve(task);
        });
    }

    function _run (projectname, _window) {
        _window = _window || window;
        _fetchProject(projectname).done(function(project) {
            project = project[0];
            function getNextTask(offset, previousTask) {
                offset = offset || 0;
                var def = $.Deferred();
                var taskId = _getCurrentTaskId(_window.location.pathname);
                if (typeof project === 'undefined' || !project) {
                    console.log("Warning: project seems undefined. Did you run in your project pybossa.run('projectname'); with the right name?");
                };
                var xhr = (taskId && (previousTask === undefined)) ? _fetchTask(taskId) : _fetchNewTask(project.id, offset);
                xhr.done(function(task) {
                    if (previousTask && task.id === previousTask.id) {
                        var secondTry = _fetchNewTask(project.id, offset+1)
                        .done(function(secondTask){
                            _resolveNextTaskLoaded(secondTask, def);
                        });
                    }
                    else {
                        _resolveNextTaskLoaded(task, def);
                    }
                });
                return def.promise();
            }

            function loop(task) {
                var taskSolved = $.Deferred(),
                    nextUrl;
                if (task.id) {
                    if (url != '/') {
                        nextUrl = url + '/project/' + projectname + '/task/' + task.id;
                    }
                    else {
                        nextUrl = '/project/' + projectname + '/task/' + task.id;
                    }
                    history.pushState({}, "Title", nextUrl);
                }
                _presentTask(task, taskSolved);
                $.when(taskSolved).then(function() {
                    getNextTask(0, task).done(loop);
                });
            }
            getNextTask(0, undefined).done(loop);
        });
    }


    // Public methods
    pybossa.newTask = function (projectname) {
        return _getProject(projectname).then(_getNewTask);
    };

    pybossa.saveTask = function (taskId, answer) {
        if (typeof(taskId) === "number") {
            return _fetchTask(taskId).then(_createTaskRun.bind(undefined, answer));
        }
        if (typeof(taskId) === "object") {
            var task = taskId
            return _createTaskRun(answer, task);
        }
    };

    pybossa.getCurrentTaskId = function (url) {
        if (url !== undefined) {
            return _getCurrentTaskId(url);
        }
        else {
            return _getCurrentTaskId(window.location.pathname);
        }
    };

    pybossa.userProgress = function (projectname) {
        return _userProgress( projectname );
    };

    pybossa.run = function (projectname, _window) {
        return _run(projectname, _window);
    };

    pybossa.taskLoaded = function (userFunc) {
        return _setUserTaskLoaded( userFunc );
    };

    pybossa.presentTask = function (userFunc) {
        return _setUserPresentTask( userFunc );
    };

    pybossa.setEndpoint = function (endpoint) {
        // Check that the URL has the trailing slash, otherwise add it
        if ( endpoint.charAt(endpoint.length-1) != '/' ) {
            endpoint += '/';
        }
        url = endpoint;
        return url;
    };

    pybossa.cancelTask = function (projectname, taskId) {
        _cancelTask(projectname, taskId).done(function(){
            window.location.replace('/project/' + projectname);
        });
    };

    pybossa.fetchLock = function (taskId) {
        return _fetchLock(taskId);
    }
} (window.pybossa = window.pybossa || {}, jQuery));

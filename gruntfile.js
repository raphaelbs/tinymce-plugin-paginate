var shell = require("shelljs");

module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
      jshint: {
        gruntfile: ['gruntfile.js'],
        scripts: ['scripts/**/*.js'],
        js: {
          options: {
            node: true,
            browser: true,
            browserify: true,
            globals: {
              '$': true,
              'jQuery': true,
              'tinymce': true
            }
          },
          files: {
            src: ['src/**/*.js']
          }
        }
      },
      browserify: {
        dist: {
          src: 'index.js',
          dest: 'plugin.js'
        }
      },
      uglify: {
        dist: {
          files: {
            'plugin.min.js': ['plugin.js']
          }
        }
      },
      watch: {
        gruntfile: {
          files: 'Gruntfile.js',
          tasks: ['jshint:gruntfile'],
        },
        js: {
          files: ['src/**/*.js'],
          tasks: ['dev'],
        }
      },
      bump: {
        options: {
          files: ['package.json','bower.json'],
          updateConfigs: [],
          commit: true,
          commitMessage: 'Release v%VERSION%',
          commitFiles: ['package.json','bower.json'],
          createTag: true,
          tagName: 'v%VERSION%',
          tagMessage: 'Version %VERSION%',
          push: true,
          pushTo: 'gh-sirap-group',
          gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
          globalReplace: false,
          prereleaseName: false,
          regExp: false
        }
      },
      copy: {
        "to_project": {
          files: [
            {src: 
              ['plugin.js', 'plugin.min.js'], 
              dest: '../../app/lib/js/tinymce/plugins/paginate/', flatten: true, expand: true
            }
          ]
        }
      }
    });

    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('jsdoc', function(){
      shell.exec('npm run jsdoc');
    });

    grunt.registerTask('build', ['jshint', 'browserify', 'uglify', 'jsdoc']);

    grunt.registerTask('dev', ['jshint', 'browserify', 'uglify', 'copy:to_project', 'watch']);

    grunt.registerTask('copy-to-project', ["copy:to_project"]);

    grunt.registerTask('default', ['dev']);
    
    grunt.registerTask('build-copy', ['build', 'copy-to-project']);
};

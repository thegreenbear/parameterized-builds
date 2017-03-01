package com.kylenicholls.stash.parameterizedbuilds.conditions;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.bitbucket.permission.*;
import com.atlassian.bitbucket.repository.Repository;
import com.atlassian.bitbucket.setting.Settings;
import com.kylenicholls.stash.parameterizedbuilds.helper.SettingsService;
import com.kylenicholls.stash.parameterizedbuilds.item.Job;
import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.*;
import static org.mockito.Matchers.any;
import static org.mockito.Matchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class BuildPermissionsConditionTest {

    private BuildPermissionsCondition condition;
    private Repository repository;
    private Map<String, Object> context;
    private SettingsService settingsService;
    private Settings settings;

    @Before
    public void setup() {
        repository = mock(Repository.class);
        settingsService = mock(SettingsService.class);
        settings = mock(Settings.class);

        context = new HashMap<>();
        context.put("repository", repository);

        PermissionService permissionService = mock(PermissionService.class);
        AuthenticationContext authContext = mock(AuthenticationContext.class);
        condition = new BuildPermissionsCondition(permissionService, settingsService, authContext);

        when(permissionService.hasRepositoryPermission(any(), any(), eq(Permission.REPO_WRITE))).thenReturn(true);
        when(permissionService.hasRepositoryPermission(any(), any(), eq(Permission.REPO_READ))).thenReturn(true);
    }

    @Test
    public void testShouldNotDisplayIfRepositoryNull() {
        context.put("repository", null);
        assertFalse(condition.shouldDisplay(context));
    }

    @Test
    public void testShouldNotDisplayIfNotRepository() {
        context.put("repository", "notARepository");
        assertFalse(condition.shouldDisplay(context));
    }

    @Test
    public void testShouldNotDisplayIfInsufficientPermissions() {
        when(settingsService.getSettings(repository)).thenReturn(settings);
        Job job = new Job.JobBuilder(1).permissions("REPO_ADMIN").build();
        List<Job> jobs = new ArrayList<>();
        jobs.add(job);
        when(settingsService.getJobs(any())).thenReturn(jobs);
        assertFalse(condition.shouldDisplay(context));
    }

    @Test
    public void testShouldDisplayExplicitPermissionPresent() {
        when(settingsService.getSettings(repository)).thenReturn(settings);
        Job job = new Job.JobBuilder(1).permissions("REPO_WRITE").build();
        List<Job> jobs = new ArrayList<>();
        jobs.add(job);
        when(settingsService.getJobs(any())).thenReturn(jobs);
        assertTrue(condition.shouldDisplay(context));
    }

    @Test
    public void testShouldDisplayImplicitPermissionPresent() {
        when(settingsService.getSettings(repository)).thenReturn(settings);
        Job job = new Job.JobBuilder(1).permissions("REPO_READ").build();
        List<Job> jobs = new ArrayList<>();
        jobs.add(job);
        when(settingsService.getJobs(any())).thenReturn(jobs);
        assertTrue(condition.shouldDisplay(context));
    }

    @Test
    public void testShouldDisplayBadPermission() {
        when(settingsService.getSettings(repository)).thenReturn(settings);
        Job job = new Job.JobBuilder(1).permissions("None").build();
        List<Job> jobs = new ArrayList<>();
        jobs.add(job);
        when(settingsService.getJobs(any())).thenReturn(jobs);
        assertTrue(condition.shouldDisplay(context));
    }
}